import { ReportClient } from "../../../src/report-client";

export default async function ReportRoute({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <ReportClient publicId={publicId} />;
}
