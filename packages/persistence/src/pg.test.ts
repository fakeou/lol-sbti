import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Repository, type ClaimedJob } from "./index.js";

const url = process.env.DATABASE_URL;
const pgDescribe = url ? describe : describe.skip;

pgDescribe("PostgreSQL repository (requires DATABASE_URL)", () => {
  const pool = new Pool({ connectionString: url });
  const key = Buffer.alloc(32, 1);
  const pepper = "test-pepper";
  let repo: Repository;
  let sequence = 0;

  const ids = (prefix = "case") => {
    sequence++;
    return { installationId: `ins_${prefix}_${sequence}`, analysisId: `ana_${prefix}_${sequence}`, jobId: `job_${prefix}_${sequence}` };
  };
  async function create(prefix = "case", overrides: Record<string, unknown> = {}) {
    const id = ids(prefix);
    await repo.createInstallation(id.installationId, `credential_${prefix}_${sequence}`);
    const created = await repo.createAnalysis({
      id: id.analysisId,
      installationId: id.installationId,
      idempotencyKey: `123e4567-e89b-42d3-a456-${String(sequence).padStart(12, "0")}`,
      payload: { prefix },
      inputExpiresAt: new Date(Date.now() + 60_000),
      resultExpiresAt: new Date(Date.now() + 120_000),
      jobId: id.jobId,
      ...overrides,
    } as any);
    return { ...id, ...created };
  }
  async function validating(prefix: string) {
    const value = await create(prefix);
    const job = await repo.claimJob(30_000, `owner_${prefix}`);
    expect(job?.analysisId).toBe(value.analysisId);
    expect(await repo.markValidating(job!)).toBe(true);
    return { ...value, job: job! };
  }
  async function completed(prefix: string) {
    const value = await validating(prefix);
    const publicId = `pub_${prefix}_${sequence}`;
    expect(await repo.complete(value.job, { report: prefix }, { tokens: 1 }, { publicId, expiresAt: new Date(Date.now() + 60_000), provider: "fake", modelId: "m", promptVersion: "v1" })).toBe(true);
    const found = await repo.findByReceipt(value.analysisId, value.receiptToken);
    return { ...value, publicId, shareSecret: found!.shareSecret! };
  }

  beforeAll(async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const migration = await readFile(resolve(process.cwd(), "../../infra/migrations/001_backend.sql"), "utf8");
    await pool.query(migration);
    repo = new Repository(pool, pepper, key);
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE share_sessions, share_grants, analysis_jobs, analyses, installations, provider_daily_budget CASCADE");
  });
  afterAll(async () => pool.end());

  it("runs migration with all repository tables and constraints", async () => {
    const names = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
    expect(names).toEqual(["analyses", "analysis_jobs", "installations", "provider_daily_budget", "share_grants", "share_sessions"]);
    await expect(pool.query("INSERT INTO analysis_jobs(id,analysis_id,attempt,status) VALUES('bad','missing',1,'unknown')")).rejects.toThrow();
  });

  it("creates one analysis/job under concurrent idempotent requests", async () => {
    const id = ids("idem");
    await repo.createInstallation(id.installationId, `credential_${sequence}`);
    const base = { installationId: id.installationId, idempotencyKey: `123e4567-e89b-42d3-a456-${String(sequence).padStart(12, "0")}`, payload: { x: 1 }, inputExpiresAt: new Date(Date.now() + 60_000), resultExpiresAt: new Date(Date.now() + 120_000) };
    const [a, b] = await Promise.all([
      repo.createAnalysis({ ...base, id: id.analysisId, jobId: id.jobId }),
      repo.createAnalysis({ ...base, id: `${id.analysisId}_other`, jobId: `${id.jobId}_other` }),
    ]);
    expect(a.receiptToken).toBe(b.receiptToken);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect((await pool.query("SELECT count(*)::int n FROM analyses WHERE installation_id=$1", [id.installationId])).rows[0].n).toBe(1);
    expect((await pool.query("SELECT count(*)::int n FROM analysis_jobs WHERE analysis_id IN (SELECT id FROM analyses WHERE installation_id=$1)", [id.installationId])).rows[0].n).toBe(1);
    const recovered = await repo.recoverReceipt(a.analysis.id, id.installationId, base.idempotencyKey);
    expect(recovered?.receiptToken).toBe(a.receiptToken);
    expect(await repo.recoverReceipt(a.analysis.id, "ins_wrong", base.idempotencyKey)).toBeUndefined();
    expect(await repo.recoverReceipt(a.analysis.id, id.installationId, "123e4567-e89b-42d3-a456-999999999999")).toBeUndefined();
  });

  it("atomically claims each job once across concurrent workers", async () => {
    const value = await create("claim");
    const claims = await Promise.all(Array.from({ length: 8 }, (_, i) => repo.claimJob(30_000, `owner_${i}`)));
    const jobs = claims.filter((x): x is ClaimedJob => Boolean(x));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.analysisId).toBe(value.analysisId);
  });

  it("heartbeats, reclaims expired leases, and fences stale owners", async () => {
    const value = await create("lease");
    const stale = (await repo.claimJob(30_000, "old_owner"))!;
    expect(await repo.heartbeat(stale, 30_000)).toBe(true);
    await pool.query("UPDATE analysis_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [stale.id]);
    const current = (await repo.claimJob(30_000, "new_owner"))!;
    expect(current.analysisId).toBe(value.analysisId);
    expect(current.fence).toBeGreaterThan(stale.fence);
    expect(await repo.heartbeat(stale, 30_000)).toBe(false);
    expect(await repo.markValidating(stale)).toBe(false);
    expect(await repo.failOrRetry(stale, "STALE", true, 3, 0)).toBe(false);
    expect(await repo.markValidating(current)).toBe(true);
    expect(await repo.complete(stale, {}, {}, { publicId: `pub_stale_${sequence}`, expiresAt: new Date(Date.now() + 60_000), provider: "x", modelId: "x", promptVersion: "x" })).toBe(false);
  });

  it("ends an automatic retry attempt and only claims the new delayed attempt", async () => {
    const value = await create("auto_retry");
    const first = (await repo.claimJob(30_000, "retry_owner"))!;
    expect(await repo.failOrRetry(first, "TEMP", true, 3, 60_000)).toBe(true);
    const rows = (await pool.query("SELECT attempt,status FROM analysis_jobs WHERE analysis_id=$1 ORDER BY attempt", [value.analysisId])).rows;
    expect(rows).toEqual([{ attempt: 1, status: "failed" }, { attempt: 2, status: "queued" }]);
    expect(await repo.claimJob(30_000, "too_early")).toBeUndefined();
    await pool.query("UPDATE analysis_jobs SET available_at=now() WHERE analysis_id=$1 AND attempt=2", [value.analysisId]);
    const second = await repo.claimJob(30_000, "retry_owner_2");
    expect(second?.attempt).toBe(2);
    expect((await pool.query("SELECT count(*)::int n FROM analysis_jobs WHERE analysis_id=$1 AND status='processing'", [value.analysisId])).rows[0].n).toBe(1);
  });

  it("serializes concurrent manual retries and changes analysis/job atomically", async () => {
    const value = await create("manual_retry");
    const first = (await repo.claimJob(30_000, "manual_owner"))!;
    expect(await repo.failOrRetry(first, "TEMP", true, 1, 0)).toBe(true);
    const results = await Promise.all(Array.from({ length: 6 }, () => repo.retryAnalysis(value.analysisId, value.receiptToken, 3)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await pool.query("SELECT status FROM analyses WHERE id=$1", [value.analysisId])).rows[0].status).toBe("queued");
    expect((await pool.query("SELECT count(*)::int n FROM analysis_jobs WHERE analysis_id=$1 AND attempt=2", [value.analysisId])).rows[0].n).toBe(1);
  });

  it("rolls back completion fully when grant insertion fails", async () => {
    const existing = await completed("rollback_existing");
    const value = await validating("rollback");
    await expect(repo.complete(value.job, { report: "must-not-stick" }, {}, { publicId: existing.publicId, expiresAt: new Date(Date.now() + 60_000), provider: "fake", modelId: "m", promptVersion: "v1" })).rejects.toThrow();
    expect((await pool.query("SELECT status,result_payload FROM analyses WHERE id=$1", [value.analysisId])).rows[0]).toEqual({ status: "validating", result_payload: null });
    expect((await pool.query("SELECT status FROM analysis_jobs WHERE id=$1", [value.job.id])).rows[0].status).toBe("processing");
  });

  it("enforces share view/session limits, revoke and delete", async () => {
    const value = await completed("share");
    await pool.query("UPDATE share_grants SET max_views=1 WHERE public_id=$1", [value.publicId]);
    expect(await repo.createShareSession(value.publicId, "wrong_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "bad_session", new Date(Date.now() + 60_000))).toBe("not_found");
    expect(await repo.createShareSession(value.publicId, value.shareSecret, "session_one_xxxxxxxxxxxxxxxxxxxxxxxxxxxx", new Date(Date.now() + 60_000))).toBe("created");
    expect(await repo.createShareSession(value.publicId, value.shareSecret, "session_two_xxxxxxxxxxxxxxxxxxxxxxxxxxxx", new Date(Date.now() + 60_000))).toBe("gone");
    expect((await repo.getPublicReport(value.publicId, "session_one_xxxxxxxxxxxxxxxxxxxxxxxxxxxx")).state).toBe("ok");
    expect(await repo.revokeShare(value.analysisId, value.receiptToken)).toBe(true);
    expect((await repo.getPublicReport(value.publicId, "session_one_xxxxxxxxxxxxxxxxxxxxxxxxxxxx")).state).toBe("gone");
    expect(await repo.deleteAnalysis(value.analysisId, value.receiptToken)).toBe(true);
    expect((await pool.query("SELECT status,result_payload,input_payload_encrypted FROM analyses WHERE id=$1", [value.analysisId])).rows[0]).toEqual({ status: "deleted", result_payload: null, input_payload_encrypted: null });
  });

  it("cleans expired input/results and sessions", async () => {
    const value = await completed("cleanup");
    await repo.createShareSession(value.publicId, value.shareSecret, "expired_session_xxxxxxxxxxxxxxxxxxxxxxxxx", new Date(Date.now() - 1_000));
    await pool.query("UPDATE analyses SET input_expires_at=now()-interval '1 second',result_expires_at=now()-interval '1 second' WHERE id=$1", [value.analysisId]);
    expect(await repo.cleanupExpired()).toBe(1);
    expect((await pool.query("SELECT status,result_payload,input_payload_encrypted FROM analyses WHERE id=$1", [value.analysisId])).rows[0]).toEqual({ status: "expired", result_payload: null, input_payload_encrypted: null });
    expect((await pool.query("SELECT count(*)::int n FROM share_sessions WHERE public_id=$1", [value.publicId])).rows[0].n).toBe(0);
    expect((await pool.query("SELECT revoked_at IS NOT NULL revoked FROM share_grants WHERE public_id=$1", [value.publicId])).rows[0].revoked).toBe(true);
  });
});
