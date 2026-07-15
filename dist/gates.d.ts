import type { ManiflightReport } from "./model.js";
export interface GateOptions {
    failUnder: number | null;
    failOnHigh: boolean;
}
export declare function evaluateGates(report: ManiflightReport, options: GateOptions): string[];
