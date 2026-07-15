import type { ManiflightReport } from "../model.js";
import type { ComparisonReport } from "../report/compare.js";
export declare function renderReportHtml(report: ManiflightReport, comparison?: ComparisonReport): string;
export declare const renderHtml: typeof renderReportHtml;
export default renderReportHtml;
