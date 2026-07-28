import { mockReport, sparseMockReport } from "../../../src/mock-report";
import { Report } from "../../../src/report-client";

type DebugReportRouteProps = {
  searchParams: Promise<{ variant?: string | string[] }>;
};

export default async function DebugReportRoute({ searchParams }: DebugReportRouteProps) {
  const { variant } = await searchParams;
  const selectedVariant = Array.isArray(variant) ? variant[0] : variant;
  const report = selectedVariant === "sparse" ? sparseMockReport : mockReport;

  return <Report report={report} />;
}
