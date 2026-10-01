import type { FlightAction, FlightSignal, PullRequestFlightReport } from "./model.js";
import { sanitizeText, sanitizeUrl } from "./sanitize.js";

const STATUS_LABEL: Record<FlightSignal["status"], string> = {
  pass: "PASS",
  blocked: "BLOCKED",
  action_required: "ACTION",
  waiting: "WAITING",
  unknown: "UNKNOWN",
  info: "INFO",
};

// Observed conditions are listed by urgency; unknowns get their own section.
const STATUS_ORDER: Record<FlightSignal["status"], number> = {
  blocked: 0,
  action_required: 1,
  waiting: 2,
  info: 3,
  pass: 4,
  unknown: 5,
};

export interface RenderPullRequestFlightOptions {
  /** Add ANSI color to Maniflight's own labels. Remote text is never colored or passed through. */
  color?: boolean;
}

type Tone = "red" | "yellow" | "cyan" | "magenta" | "green" | "dim" | "bold";

const ANSI: Record<Tone, [string, string]> = {
  red: ["\u001b[31m", "\u001b[39m"],
  yellow: ["\u001b[33m", "\u001b[39m"],
  cyan: ["\u001b[36m", "\u001b[39m"],
  magenta: ["\u001b[35m", "\u001b[39m"],
  green: ["\u001b[32m", "\u001b[39m"],
  dim: ["\u001b[2m", "\u001b[22m"],
  bold: ["\u001b[1m", "\u001b[22m"],
};

const STATUS_TONE: Record<FlightSignal["status"], Tone> = {
  blocked: "red",
  action_required: "yellow",
  waiting: "cyan",
  unknown: "magenta",
  pass: "green",
  info: "dim",
};

const OUTCOME_TONE: Record<PullRequestFlightReport["outcome"]["status"], Tone> = {
  ready: "green",
  ready_with_warnings: "yellow",
  blocked: "red",
  action_required: "yellow",
  waiting: "cyan",
  unknown: "magenta",
  merged: "green",
  closed: "dim",
};

const LABEL_WIDTH = 13;

export function renderPullRequestFlight(
  report: PullRequestFlightReport,
  options: RenderPullRequestFlightOptions = {},
): string {
  const paint = (tone: Tone, text: string): string =>
    options.color ? `${ANSI[tone][0]}${text}${ANSI[tone][1]}` : text;
  const row = (label: string, value: string, tone?: Tone): string => {
    const padded = label.padEnd(LABEL_WIDTH);
    return `${tone ? paint(tone, padded) : padded}${value}`;
  };
  const link = (url: string): string => row("SOURCE", paint("dim", url), "dim");
  const heading = (text: string): string => paint("bold", text);

  const actors =
    report.outcome.nextActors.length > 0 ? report.outcome.nextActors.join(", ") : "none";
  const visibleSignals = report.signals
    .filter(
      (signal) =>
        (signal.status !== "pass" && signal.status !== "info") ||
        (report.outcome.status === "ready_with_warnings" && signal.status === "info"),
    )
    .map((signal, index) => ({ signal, index }))
    .sort(
      (left, right) =>
        STATUS_ORDER[left.signal.status] - STATUS_ORDER[right.signal.status] ||
        left.index - right.index,
    )
    .map(({ signal }) => signal);

  const signalRows = (signal: FlightSignal): string[] => {
    const suffix = signal.blocking ? " [merge blocker]" : "";
    const sourceUrl = sanitizeUrl(signal.evidence[0]?.url);
    return [
      row(
        STATUS_LABEL[signal.status],
        `${sanitizeText(signal.summary, 240)}${suffix}`,
        STATUS_TONE[signal.status],
      ),
      ...(signal.detail ? [row("DETAIL", sanitizeText(signal.detail, 240))] : []),
      ...(sourceUrl ? [link(sourceUrl)] : []),
    ];
  };

  const observed = visibleSignals.filter((signal) => signal.status !== "unknown");
  const gaps = visibleSignals.filter((signal) => signal.status === "unknown");

  const observedLines = observed.flatMap(signalRows);
  if (visibleSignals.length === 0) {
    const label = report.outcome.status === "closed" ? "INFO" : "PASS";
    observedLines.push(
      row(label, sanitizeText(report.outcome.summary, 240), label === "PASS" ? "green" : "dim"),
    );
    const pullRequestUrl = sanitizeUrl(report.pullRequest.url);
    if (pullRequestUrl) observedLines.push(link(pullRequestUrl));
  }

  const gapLines = gaps.length > 0 ? [heading("Evidence gaps"), ...gaps.flatMap(signalRows)] : [];

  const actionLines = (action: FlightAction): string[] => {
    const url = sanitizeUrl(action.url);
    return [
      // "unknown" already labels evidence gaps; an action without a reliable owner reads clearer as unassigned.
      row(
        action.actor === "unknown" ? "UNASSIGNED" : action.actor.toUpperCase(),
        sanitizeText(action.summary, 240),
        "bold",
      ),
      ...(url ? [row("", paint("dim", url))] : []),
    ];
  };
  const nextStepLines =
    report.nextActions.length > 0
      ? [heading("Next steps"), ...report.nextActions.flatMap(actionLines)]
      : [];

  const warningLines = report.collection.warnings.map(
    (warning) => `- ${sanitizeText(warning, 240)}`,
  );

  const sections = [
    [
      heading("Maniflight PR Flight Director"),
      `${report.pullRequest.repository}#${report.pullRequest.number}`,
      sanitizeText(report.pullRequest.title, 240),
    ],
    [
      row(
        "STATUS",
        paint(
          OUTCOME_TONE[report.outcome.status],
          report.outcome.status.toUpperCase().replaceAll("_", " "),
        ),
      ),
      row("NEXT ACTORS", actors),
      row("HEAD", report.pullRequest.head.sha.slice(0, 12)),
    ],
    observedLines,
    gapLines,
    nextStepLines,
    warningLines.length > 0 ? [heading("Evidence warnings"), ...warningLines] : [],
  ].filter((section) => section.length > 0);

  return `${sections.map((section) => section.join("\n")).join("\n\n")}\n`;
}

/** Color only for an interactive terminal, honoring the NO_COLOR and FORCE_COLOR conventions. */
export function shouldUseColor(
  stream: { isTTY?: boolean },
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "" && env.FORCE_COLOR !== "0") {
    return true;
  }
  return stream.isTTY === true && env.TERM !== "dumb";
}
