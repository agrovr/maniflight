import type { FlightSignal, PullRequestFlightReport } from "./model.js";
import { sanitizeText, sanitizeUrl } from "./sanitize.js";

const STATUS_LABEL: Record<FlightSignal["status"], string> = {
  pass: "PASS",
  blocked: "BLOCKED",
  action_required: "ACTION",
  waiting: "WAITING",
  unknown: "UNKNOWN",
  info: "INFO",
};

function row(label: string, value: string): string {
  return `${label.padEnd(13)}${value}`;
}

export function renderPullRequestFlight(report: PullRequestFlightReport): string {
  const actors =
    report.outcome.nextActors.length > 0 ? report.outcome.nextActors.join(", ") : "none";
  const visibleSignals = report.signals.filter(
    (signal) =>
      (signal.status !== "pass" && signal.status !== "info") ||
      (report.outcome.status === "ready_with_warnings" && signal.status === "info"),
  );
  const signalLines = visibleSignals.flatMap((signal) => {
    const suffix = signal.blocking ? " [merge blocker]" : "";
    const sourceUrl = sanitizeUrl(signal.evidence[0]?.url);
    return [
      row(STATUS_LABEL[signal.status], `${sanitizeText(signal.summary, 240)}${suffix}`),
      ...(signal.detail ? [row("DETAIL", sanitizeText(signal.detail, 240))] : []),
      ...(sourceUrl ? [row("SOURCE", sourceUrl)] : []),
    ];
  });
  if (signalLines.length === 0) {
    const label = report.outcome.status === "closed" ? "INFO" : "PASS";
    signalLines.push(row(label, sanitizeText(report.outcome.summary, 240)));
    const pullRequestUrl = sanitizeUrl(report.pullRequest.url);
    if (pullRequestUrl) signalLines.push(row("SOURCE", pullRequestUrl));
  }
  const warningLines = report.collection.warnings.map(
    (warning) => `- ${sanitizeText(warning, 240)}`,
  );

  return `${[
    "Maniflight PR Flight Director",
    `${report.pullRequest.repository}#${report.pullRequest.number}`,
    sanitizeText(report.pullRequest.title, 240),
    "",
    row("STATUS", report.outcome.status.toUpperCase().replaceAll("_", " ")),
    row("NEXT ACTORS", actors),
    row("HEAD", report.pullRequest.head.sha.slice(0, 12)),
    "",
    ...signalLines,
    ...(warningLines.length > 0 ? ["", "Evidence warnings", ...warningLines] : []),
  ].join("\n")}\n`;
}
