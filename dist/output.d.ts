import type { ManiflightReport } from "./model.js";
import type { ComparisonReport } from "./report/compare.js";
export declare const BASELINE_REPORT_MAX_BYTES: number;
export interface ReportArtifactPaths {
    directory: string;
    html: string;
    json: string;
    svg: string;
    comparison?: string;
}
export declare function loadBaselineReport(reportPath: string, allowedRoot?: string): Promise<ManiflightReport>;
export declare function writeComparisonArtifact(comparison: ComparisonReport, outputDirectory: string, allowedRoot?: string): Promise<string>;
export declare function writeReportArtifacts(report: ManiflightReport, outputDirectory: string, allowedRoot?: string, comparison?: ComparisonReport): Promise<ReportArtifactPaths>;
