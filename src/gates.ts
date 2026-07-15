import type { ManiflightReport } from "./model.js";

export interface GateOptions {
  failUnder: number | null;
  failOnHigh: boolean;
  failOnRegression?: boolean;
  regressionCount?: number;
}

export function evaluateGates(report: ManiflightReport, options: GateOptions): string[] {
  const failures: string[] = [];

  if (options.failUnder !== null) {
    if (report.overall.score === null) {
      failures.push(
        `No overall score was available for the configured threshold of ${options.failUnder}`,
      );
    } else if (report.overall.score < options.failUnder) {
      failures.push(
        `Overall score ${report.overall.score} is below the configured threshold of ${options.failUnder}`,
      );
    }
  }

  if (options.failOnHigh && report.summary.highFindings > 0) {
    failures.push(
      `${report.summary.highFindings} unwaived high-severity finding(s) need attention`,
    );
  }

  if (options.failOnRegression) {
    if (options.regressionCount === undefined) {
      failures.push("Regression gating requires a baseline report");
    } else if (options.regressionCount > 0) {
      failures.push(
        `${options.regressionCount} readiness ${options.regressionCount === 1 ? "regression was" : "regressions were"} introduced from the baseline`,
      );
    }
  }

  return failures;
}
