import type { ManiflightReport } from "./model.js";
export interface GateOptions {
    failUnder: number | null;
    failOnHigh: boolean;
    failOnRegression?: boolean;
    regressionCount?: number;
}
export declare function evaluateGates(report: ManiflightReport, options: GateOptions): string[];
