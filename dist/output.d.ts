import type { ManiflightReport } from "./model.js";
export interface ReportArtifactPaths {
    directory: string;
    html: string;
    json: string;
    svg: string;
}
export declare function writeReportArtifacts(report: ManiflightReport, outputDirectory: string, allowedRoot?: string): Promise<ReportArtifactPaths>;
