import { type CheckResult, type CheckStatus, DOMAINS, type ManiflightReport } from "../model.js";

export const COMPARISON_SCHEMA_VERSION = "1.0" as const;

export type ComparisonReportSide = "baseline" | "current";
export type MatchedRuleChangeKind = "regression" | "improvement" | "evidence_change" | "unchanged";

export interface ComparisonRepository {
  name: string;
  owner?: string;
  url?: string;
}

export interface ComparisonSubject {
  repository: ComparisonRepository;
  reportSchemaVersion: ManiflightReport["schemaVersion"];
  toolVersion: string;
  generatedAt?: string;
  score: number | null;
  confidence: number;
}

export interface RuleState {
  domain: CheckResult["domain"];
  title: string;
  status: CheckStatus;
  severity: CheckResult["severity"];
}

export interface MatchedRuleChange<Kind extends MatchedRuleChangeKind = MatchedRuleChangeKind> {
  ruleId: string;
  kind: Kind;
  baseline: RuleState;
  current: RuleState;
}

export interface AddedRuleChange {
  ruleId: string;
  kind: "added";
  current: RuleState;
}

export interface RemovedRuleChange {
  ruleId: string;
  kind: "removed";
  baseline: RuleState;
}

export interface MetricDelta {
  baseline: number;
  current: number;
  delta: number;
}

export interface NullableMetricDelta {
  baseline: number | null;
  current: number | null;
  delta: number | null;
}

export interface ComparisonSummary {
  regressions: number;
  improvements: number;
  evidenceChanges: number;
  added: number;
  removed: number;
  unchanged: number;
}

export interface ComparisonReport {
  schemaVersion: typeof COMPARISON_SCHEMA_VERSION;
  baseline: ComparisonSubject;
  current: ComparisonSubject;
  metrics: {
    score: NullableMetricDelta;
    confidence: MetricDelta;
  };
  summary: ComparisonSummary;
  regressions: MatchedRuleChange<"regression">[];
  improvements: MatchedRuleChange<"improvement">[];
  evidenceChanges: MatchedRuleChange<"evidence_change">[];
  added: AddedRuleChange[];
  removed: RemovedRuleChange[];
  unchanged: MatchedRuleChange<"unchanged">[];
}

function reportChecks(report: ManiflightReport): CheckResult[] {
  return DOMAINS.flatMap((domain) => report.domains[domain].checks);
}

function indexChecks(
  report: ManiflightReport,
  side: ComparisonReportSide,
): Map<string, CheckResult> {
  const checksByRuleId = new Map<string, CheckResult>();

  for (const check of reportChecks(report)) {
    if (checksByRuleId.has(check.ruleId)) {
      throw new Error(`Duplicate rule ID "${check.ruleId}" in ${side} report.`);
    }
    checksByRuleId.set(check.ruleId, check);
  }

  return checksByRuleId;
}

function ruleState(check: CheckResult): RuleState {
  return {
    domain: check.domain,
    title: check.title,
    status: check.status,
    severity: check.severity,
  };
}

function classifyMatchedRule(
  currentStatus: CheckStatus,
  baselineStatus: CheckStatus,
): MatchedRuleChangeKind {
  if (currentStatus === baselineStatus) return "unchanged";

  if (
    currentStatus === "unknown" ||
    currentStatus === "not_applicable" ||
    baselineStatus === "unknown" ||
    baselineStatus === "not_applicable"
  ) {
    return "evidence_change";
  }

  const readiness: Record<"fail" | "warn" | "pass", number> = {
    fail: 0,
    warn: 1,
    pass: 2,
  };

  return readiness[currentStatus] < readiness[baselineStatus] ? "regression" : "improvement";
}

function roundDelta(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  if (!Number.isFinite(rounded)) {
    throw new Error("Comparison metric delta must be finite.");
  }
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertPercentage(value: number | null, label: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error(`${label} must be a finite number from 0 to 100 or null.`);
  }
}

function metricDelta(current: number, baseline: number): MetricDelta {
  return {
    baseline,
    current,
    delta: roundDelta(current - baseline),
  };
}

function nullableMetricDelta(current: number | null, baseline: number | null): NullableMetricDelta {
  return {
    baseline,
    current,
    delta: current === null || baseline === null ? null : roundDelta(current - baseline),
  };
}

function comparisonSubject(report: ManiflightReport): ComparisonSubject {
  return {
    repository: {
      name: report.repository.name,
      ...(report.repository.owner ? { owner: report.repository.owner } : {}),
      ...(report.repository.url ? { url: report.repository.url } : {}),
    },
    reportSchemaVersion: report.schemaVersion,
    toolVersion: report.tool.version,
    ...(report.generatedAt ? { generatedAt: report.generatedAt } : {}),
    score: report.overall.score,
    confidence: report.overall.confidence,
  };
}

export function compareReports(
  current: ManiflightReport,
  baseline: ManiflightReport,
): ComparisonReport {
  assertPercentage(current.overall.score, "Current score");
  assertPercentage(current.overall.confidence, "Current confidence");
  assertPercentage(baseline.overall.score, "Baseline score");
  assertPercentage(baseline.overall.confidence, "Baseline confidence");

  const currentChecks = indexChecks(current, "current");
  const baselineChecks = indexChecks(baseline, "baseline");
  const ruleIds = [...new Set([...currentChecks.keys(), ...baselineChecks.keys()])].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const regressions: MatchedRuleChange<"regression">[] = [];
  const improvements: MatchedRuleChange<"improvement">[] = [];
  const evidenceChanges: MatchedRuleChange<"evidence_change">[] = [];
  const added: AddedRuleChange[] = [];
  const removed: RemovedRuleChange[] = [];
  const unchanged: MatchedRuleChange<"unchanged">[] = [];

  for (const ruleId of ruleIds) {
    const currentCheck = currentChecks.get(ruleId);
    const baselineCheck = baselineChecks.get(ruleId);

    if (!baselineCheck && currentCheck) {
      added.push({ ruleId, kind: "added", current: ruleState(currentCheck) });
      continue;
    }

    if (baselineCheck && !currentCheck) {
      removed.push({ ruleId, kind: "removed", baseline: ruleState(baselineCheck) });
      continue;
    }

    if (!baselineCheck || !currentCheck) {
      continue;
    }

    const kind = classifyMatchedRule(currentCheck.status, baselineCheck.status);
    const change = {
      ruleId,
      baseline: ruleState(baselineCheck),
      current: ruleState(currentCheck),
    };

    if (kind === "regression") regressions.push({ ...change, kind });
    if (kind === "improvement") improvements.push({ ...change, kind });
    if (kind === "evidence_change") evidenceChanges.push({ ...change, kind });
    if (kind === "unchanged") unchanged.push({ ...change, kind });
  }

  return {
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    baseline: comparisonSubject(baseline),
    current: comparisonSubject(current),
    metrics: {
      score: nullableMetricDelta(current.overall.score, baseline.overall.score),
      confidence: metricDelta(current.overall.confidence, baseline.overall.confidence),
    },
    summary: {
      regressions: regressions.length,
      improvements: improvements.length,
      evidenceChanges: evidenceChanges.length,
      added: added.length,
      removed: removed.length,
      unchanged: unchanged.length,
    },
    regressions,
    improvements,
    evidenceChanges,
    added,
    removed,
    unchanged,
  };
}
