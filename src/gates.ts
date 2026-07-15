import type { ManiflightReport } from "./model.js";

export interface GateOptions {
  failUnder: number | null;
  failOnHigh: boolean;
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

  return failures;
}
