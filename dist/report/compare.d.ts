import { type CheckResult, type CheckStatus, type ManiflightReport } from "../model.js";
export declare const COMPARISON_SCHEMA_VERSION: "1.0";
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
export declare function compareReports(current: ManiflightReport, baseline: ManiflightReport): ComparisonReport;
