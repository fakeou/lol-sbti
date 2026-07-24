use chrono::{DateTime, Utc};
use match_sanitizer::CreateAnalysisRequestV1;
use parking_lot::Mutex;
use reqwest::{blocking::Client, redirect::Policy};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::PathBuf,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;

const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const SERVICE: &str = "lol-sbti.installation";
const DEFAULT_API_BASE_URL: &str = "https://api.example";
const DEFAULT_REPORT_WEB_BASE_URL: &str = "https://app.example";

pub trait CredentialStore: Send + Sync {
    fn get(&self) -> Result<Option<String>, String>;
    fn set(&self, value: &str) -> Result<(), String>;
}
pub struct WindowsCredentialStore;
impl CredentialStore for WindowsCredentialStore {
    fn get(&self) -> Result<Option<String>, String> {
        match keyring::Entry::new(SERVICE, "default")
            .map_err(|_| "无法访问 Windows 凭据管理器".to_string())?
            .get_password()
        {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("无法读取安装凭据".into()),
        }
    }
    fn set(&self, value: &str) -> Result<(), String> {
        keyring::Entry::new(SERVICE, "default")
            .map_err(|_| "无法访问 Windows 凭据管理器".to_string())?
            .set_password(value)
            .map_err(|_| "无法保存安装凭据".into())
    }
}
#[derive(Default)]
pub struct MemoryCredentialStore(Mutex<Option<String>>);
impl CredentialStore for MemoryCredentialStore {
    fn get(&self) -> Result<Option<String>, String> {
        Ok(self.0.lock().clone())
    }
    fn set(&self, value: &str) -> Result<(), String> {
        *self.0.lock() = Some(value.into());
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub count: usize,
    pub from: String,
    pub to: String,
    pub modes: HashMap<String, usize>,
    pub skipped: usize,
    pub skip_reasons: BTreeMap<String, usize>,
    pub request: CreateAnalysisRequestV1,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recovery {
    pub analysis_id: String,
    pub idempotency_key: String,
    pub management_expires_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Register {
    installation_credential: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Created {
    pub analysis_id: String,
    pub status: String,
    pub receipt_token: String,
    pub poll_after_ms: u64,
    pub input_expires_at: String,
    pub management_expires_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Recovered {
    analysis_id: String,
    receipt_token: String,
    poll_after_ms: u64,
    management_expires_at: String,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Status {
    pub analysis_id: String,
    pub status: String,
    pub stage: Option<String>,
    pub poll_after_ms: Option<u64>,
    pub share: Option<Share>,
    pub error: Option<ApiError>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Share {
    pub url: String,
    pub expires_at: String,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ApiError {
    pub code: String,
    pub retryable: bool,
}

pub struct State {
    pub base: Url,
    pub report_base: Url,
    pub http: Client,
    pub credentials: Box<dyn CredentialStore>,
    pub recovery_path: PathBuf,
    receipt: Mutex<Option<SecretString>>,
    recovery: Mutex<Option<Recovery>>,
}
impl State {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let allow_local_http =
            std::env::var("LOL_SBTI_ALLOW_LOCAL_HTTP").ok().as_deref() == Some("1");
        let base = validate_base_url(
            &std::env::var("LOL_SBTI_API_BASE_URL").unwrap_or_else(|_| DEFAULT_API_BASE_URL.into()),
            allow_local_http,
        )?;
        let report_base = validate_report_base_url(
            &std::env::var("REPORT_WEB_BASE_URL")
                .unwrap_or_else(|_| DEFAULT_REPORT_WEB_BASE_URL.into()),
            allow_local_http,
        )?;
        let path = app
            .path()
            .app_data_dir()
            .map_err(|_| "无法确定恢复目录".to_string())?
            .join("analysis-recovery.json");
        Self::with_parts(base, report_base, path, Box::new(WindowsCredentialStore))
    }
    fn with_parts(
        base: Url,
        report_base: Url,
        recovery_path: PathBuf,
        credentials: Box<dyn CredentialStore>,
    ) -> Result<Self, String> {
        let recovery = load_recovery(&recovery_path);
        Ok(Self {
            base,
            report_base,
            http: Client::builder()
                .redirect(Policy::none())
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|_| "无法创建 API 客户端".to_string())?,
            credentials,
            recovery_path,
            receipt: Mutex::new(None),
            recovery: Mutex::new(recovery),
        })
    }
}
fn load_recovery(path: &PathBuf) -> Option<Recovery> {
    let parsed = fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice::<Recovery>(&b).ok());
    let valid = parsed.filter(|r| {
        valid_analysis_id(&r.analysis_id)
            && Uuid::parse_str(&r.idempotency_key).is_ok()
            && DateTime::parse_from_rfc3339(&r.management_expires_at)
                .map(|v| v > Utc::now())
                .unwrap_or(false)
    });
    if valid.is_none() && path.exists() {
        let _ = fs::remove_file(path);
    }
    valid
}
fn contains_control(value: &str) -> bool {
    value.chars().any(char::is_control)
}
fn is_local(url: &Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"))
}
pub fn validate_base_url(value: &str, allow_local_http: bool) -> Result<Url, String> {
    if contains_control(value) {
        return Err("API 地址不能包含控制字符".into());
    }
    let url = Url::parse(value).map_err(|_| "API 地址无效".to_string())?;
    if url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("API 地址不能包含凭据、查询或 fragment".into());
    }
    if url.scheme() != "https" && !(allow_local_http && is_local(&url) && url.scheme() == "http") {
        return Err("API 地址必须使用 HTTPS；localhost HTTP 需显式启用".into());
    }
    Ok(url)
}
pub fn validate_report_base_url(value: &str, allow_local_http: bool) -> Result<Url, String> {
    let url = validate_base_url(value, allow_local_http)
        .map_err(|_| "报告 Web 基础地址无效".to_string())?;
    if url.path() != "/" {
        return Err("报告 Web 基础地址只能配置 origin".into());
    }
    Ok(url)
}
fn same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}
fn valid_share_secret(value: &str) -> bool {
    value.len() == 43
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}
pub fn validate_report_url(value: &str, report_base: &Url) -> Result<Url, String> {
    if contains_control(value) {
        return Err("报告链接不能包含控制字符".into());
    }
    let url = Url::parse(value).map_err(|_| "报告链接无效".to_string())?;
    if url.username() != "" || url.password().is_some() || url.query().is_some() {
        return Err("报告链接不能包含凭据或查询".into());
    }
    if !same_origin(&url, report_base) {
        return Err("报告链接 origin 不受信任".into());
    }
    let segments = url
        .path_segments()
        .map(|segments| segments.collect::<Vec<_>>())
        .unwrap_or_default();
    if segments.len() != 2 || segments[0] != "r" || !valid_identifier(segments[1]) {
        return Err("报告链接路径无效".into());
    }
    if !url.fragment().map(valid_share_secret).unwrap_or(false) {
        return Err("报告链接 secret 无效".into());
    }
    Ok(url)
}
fn endpoint(state: &State, path: &str) -> Result<Url, String> {
    state.base.join(path).map_err(|_| "API 路径无效".into())
}
fn credential(state: &State) -> Result<String, String> {
    if let Some(c) = state.credentials.get()? {
        return Ok(c);
    }
    let response = state
        .http
        .post(endpoint(state, "/v1/installations")?)
        .json(&serde_json::json!({"clientVersion":CLIENT_VERSION}))
        .send()
        .map_err(|_| "安装注册失败".to_string())?;
    if !response.status().is_success() {
        return Err("安装注册失败".into());
    }
    let value: Register = response
        .json()
        .map_err(|_| "安装注册响应无效".to_string())?;
    state.credentials.set(&value.installation_credential)?;
    Ok(value.installation_credential)
}
fn save_recovery(state: &State, value: &Recovery) -> Result<(), String> {
    if let Some(parent) = state.recovery_path.parent() {
        fs::create_dir_all(parent).map_err(|_| "无法创建恢复目录".to_string())?
    }
    let temporary = state.recovery_path.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec(value).map_err(|_| "无法编码恢复状态".to_string())?,
    )
    .map_err(|_| "无法保存恢复状态".to_string())?;
    fs::rename(temporary, &state.recovery_path).map_err(|_| "无法保存恢复状态".to_string())
}
fn clear_sensitive(state: &State) {
    *state.receipt.lock() = None;
    *state.recovery.lock() = None;
    let _ = fs::remove_file(&state.recovery_path);
}
fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}
fn valid_analysis_id(value: &str) -> bool {
    value.starts_with("ana_") && valid_identifier(value)
}
fn valid_server_time(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok()
}
fn valid_created(value: &Created) -> bool {
    valid_analysis_id(&value.analysis_id)
        && value.status == "queued"
        && (32..=512).contains(&value.receipt_token.len())
        && (250..=60_000).contains(&value.poll_after_ms)
        && valid_server_time(&value.input_expires_at)
        && DateTime::parse_from_rfc3339(&value.management_expires_at)
            .map(|expiry| expiry > Utc::now())
            .unwrap_or(false)
}
pub fn create(state: &State, request: &CreateAnalysisRequestV1) -> Result<Status, String> {
    match_sanitizer::validate_request(request)?;
    let key = Uuid::new_v4().to_string();
    let response = state
        .http
        .post(endpoint(state, "/v1/analyses")?)
        .bearer_auth(credential(state)?)
        .header("Idempotency-Key", &key)
        .json(request)
        .send()
        .map_err(|_| "上传失败，请重试".to_string())?;
    if !response.status().is_success() {
        return Err(format!("上传失败（HTTP {}）", response.status().as_u16()));
    }
    let created: Created = response.json().map_err(|_| "上传响应无效".to_string())?;
    if !valid_created(&created) {
        return Err("上传响应无效".into());
    }
    let saved = Recovery {
        analysis_id: created.analysis_id.clone(),
        idempotency_key: key,
        management_expires_at: created.management_expires_at.clone(),
    };
    save_recovery(state, &saved)?;
    *state.recovery.lock() = Some(saved);
    *state.receipt.lock() = Some(SecretString::from(created.receipt_token));
    Ok(Status {
        analysis_id: created.analysis_id,
        status: created.status,
        stage: None,
        poll_after_ms: Some(created.poll_after_ms),
        share: None,
        error: None,
    })
}
pub fn recover(state: &State) -> Result<Option<Status>, String> {
    let recovery = state.recovery.lock().clone();
    let Some(value) = recovery else {
        return Ok(None);
    };
    let response = state
        .http
        .post(endpoint(
            state,
            &format!("/v1/analyses/{}/recover", value.analysis_id),
        )?)
        .bearer_auth(credential(state)?)
        .json(&serde_json::json!({"idempotencyKey": value.idempotency_key}))
        .send()
        .map_err(|_| "恢复分析任务失败".to_string())?;
    if response.status().as_u16() == 404 || response.status().as_u16() == 410 {
        clear_sensitive(state);
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "恢复分析任务失败（HTTP {}）",
            response.status().as_u16()
        ));
    }
    let recovered: Recovered = response.json().map_err(|_| "恢复响应无效".to_string())?;
    if recovered.analysis_id != value.analysis_id
        || !valid_analysis_id(&recovered.analysis_id)
        || !(32..=512).contains(&recovered.receipt_token.len())
        || !(250..=60_000).contains(&recovered.poll_after_ms)
        || DateTime::parse_from_rfc3339(&recovered.management_expires_at)
            .map(|expiry| expiry <= Utc::now())
            .unwrap_or(true)
    {
        clear_sensitive(state);
        return Err("恢复响应无效".into());
    }
    let saved = Recovery {
        analysis_id: recovered.analysis_id.clone(),
        idempotency_key: value.idempotency_key,
        management_expires_at: recovered.management_expires_at,
    };
    save_recovery(state, &saved)?;
    *state.recovery.lock() = Some(saved);
    *state.receipt.lock() = Some(SecretString::from(recovered.receipt_token));
    Ok(Some(Status {
        analysis_id: recovered.analysis_id,
        status: "queued".into(),
        stage: None,
        poll_after_ms: Some(recovered.poll_after_ms),
        share: None,
        error: None,
    }))
}
pub fn status(state: &State, id: &str) -> Result<Status, String> {
    if !valid_analysis_id(id) {
        return Err("任务 ID 无效".into());
    }
    let receipt = state.receipt.lock();
    let secret = receipt.as_ref().ok_or("任务凭据已失效")?;
    let response = state
        .http
        .get(endpoint(state, &format!("/v1/analyses/{id}"))?)
        .bearer_auth(secret.expose_secret())
        .send()
        .map_err(|_| "查询进度失败".to_string())?;
    drop(receipt);
    if response.status().as_u16() == 410 {
        clear_sensitive(state);
        return Ok(Status {
            analysis_id: id.into(),
            status: "gone".into(),
            stage: None,
            poll_after_ms: None,
            share: None,
            error: None,
        });
    }
    if !response.status().is_success() {
        return Err(format!(
            "查询进度失败（HTTP {}）",
            response.status().as_u16()
        ));
    }
    let result: Status = response.json().map_err(|_| "进度响应无效".to_string())?;
    if let Some(share) = &result.share {
        validate_report_url(&share.url, &state.report_base)
            .map_err(|_| "进度响应包含不受信任的报告链接".to_string())?;
    }
    if matches!(result.status.as_str(), "gone" | "expired" | "deleted") {
        clear_sensitive(state)
    }
    Ok(result)
}
pub fn action(state: &State, id: &str, kind: &str) -> Result<(), String> {
    if !valid_analysis_id(id) {
        return Err("任务 ID 无效".into());
    }
    let receipt = state.receipt.lock();
    let secret = receipt.as_ref().ok_or("任务凭据已失效")?;
    let path = match kind {
        "retry" => format!("/v1/analyses/{id}/retry"),
        "revoke" => format!("/v1/analyses/{id}/share"),
        "delete" => format!("/v1/analyses/{id}"),
        _ => return Err("不支持的操作".into()),
    };
    let request = if kind == "retry" {
        state.http.post(endpoint(state, &path)?)
    } else {
        state.http.delete(endpoint(state, &path)?)
    };
    let response = request
        .bearer_auth(secret.expose_secret())
        .send()
        .map_err(|_| "操作失败".to_string())?;
    drop(receipt);
    if !response.status().is_success() {
        return Err(format!("操作失败（HTTP {}）", response.status().as_u16()));
    }
    if kind == "delete" {
        clear_sensitive(state)
    }
    Ok(())
}
pub fn open_report(state: &State, url: &str) -> Result<(), String> {
    let parsed = validate_report_url(url, &state.report_base)?;
    opener::open(parsed.as_str()).map_err(|_| "无法打开系统浏览器".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    #[test]
    fn url_policy() {
        assert!(validate_base_url("https://api.example", false).is_ok());
        assert!(validate_base_url("http://api.example", true).is_err());
        assert!(validate_base_url("http://localhost:3000", false).is_err());
        assert!(validate_base_url("http://localhost:3000", true).is_ok());
        assert!(validate_base_url("https://user:pass@api.example", false).is_err())
    }
    #[test]
    fn report_url_policy_binds_exact_origin_and_shape() {
        let base = validate_report_base_url("https://app.example", false).unwrap();
        let secret = "a".repeat(43);
        let valid = format!("https://app.example/r/pub_01#{secret}");
        assert!(validate_report_url(&valid, &base).is_ok());

        for invalid in [
            format!("https://user:pass@app.example/r/pub_01#{secret}"),
            format!("http://app.example/r/pub_01#{secret}"),
            format!("https://evil.example/r/pub_01#{secret}"),
            format!("https://app.example.evil.example/r/pub_01#{secret}"),
            format!("https://app.example:444/r/pub_01#{secret}"),
            format!("https://app.example/not-r/pub_01#{secret}"),
            "https://app.example/r/pub_01".to_string(),
            format!("https://app.example/r/pub_01?next=evil#{secret}"),
            format!("https://app.example/r/pub_01/extra#{secret}"),
            format!("https://app.example/r/pub_01#{}", "!".repeat(43)),
            format!("https://app.example/r/pub_01\n#{secret}"),
        ] {
            assert!(
                validate_report_url(&invalid, &base).is_err(),
                "accepted invalid report URL: {invalid:?}"
            );
        }
    }
    #[test]
    fn report_origin_uses_effective_port() {
        let implicit = validate_report_base_url("https://app.example", false).unwrap();
        let explicit = validate_report_base_url("https://app.example:443", false).unwrap();
        let secret = "A".repeat(43);
        assert!(validate_report_url(
            &format!("https://app.example:443/r/pub_01#{secret}"),
            &implicit
        )
        .is_ok());
        assert!(
            validate_report_url(&format!("https://app.example/r/pub_01#{secret}"), &explicit)
                .is_ok()
        );
        assert!(validate_report_base_url("https://app.example/r", false).is_err());
    }
    #[test]
    fn memory_store_is_explicit_and_works() {
        let s = MemoryCredentialStore::default();
        assert_eq!(s.get().unwrap(), None);
        s.set("credential").unwrap();
        assert_eq!(s.get().unwrap().as_deref(), Some("credential"))
    }
    #[test]
    fn corrupt_and_expired_recovery_is_removed() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("r.json");
        fs::write(&path, b"bad").unwrap();
        assert!(load_recovery(&path).is_none());
        assert!(!path.exists());
        let value = Recovery {
            analysis_id: "ana_1".into(),
            idempotency_key: Uuid::new_v4().to_string(),
            management_expires_at: "2020-01-01T00:00:00Z".into(),
        };
        fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
        assert!(load_recovery(&path).is_none());
        assert!(!path.exists())
    }
    #[test]
    fn recovery_has_only_the_allowed_metadata_keys() {
        let value = Recovery {
            analysis_id: "ana_1".into(),
            idempotency_key: Uuid::new_v4().to_string(),
            management_expires_at: (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
        };
        let encoded = serde_json::to_value(&value).unwrap();
        let keys = encoded
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        assert_eq!(
            keys,
            ["analysisId", "idempotencyKey", "managementExpiresAt"]
        );
        let text = encoded.to_string();
        assert!(!text.contains("receiptToken"));
        assert!(!text.contains("shareSecret"));
        assert!(!text.contains("matches"));
        assert!(!text.contains("request"));
    }

    #[test]
    fn legacy_recovery_schema_is_rejected_and_removed() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("r.json");
        fs::write(
            &path,
            serde_json::json!({
                "analysisId": "ana_1",
                "idempotencyKey": Uuid::new_v4().to_string(),
                "expiresAt": (Utc::now() + chrono::Duration::hours(24)).to_rfc3339()
            })
            .to_string(),
        )
        .unwrap();
        assert!(load_recovery(&path).is_none());
        assert!(!path.exists());
    }
}
