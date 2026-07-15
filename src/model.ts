import type { ManiflightConfig } from "./config.js";

export const DOMAINS = ["architecture", "automation", "security", "community"] as const;

export type Domain = (typeof DOMAINS)[number];
export type CheckStatus = "pass" | "warn" | "fail" | "unknown" | "not_applicable";
export type Severity = "info" | "low" | "medium" | "high";
export type EvidenceKind = "present" | "missing" | "risk" | "unknown";

export interface Evidence {
  kind: EvidenceKind;
  message: string;
  path?: string;
  line?: number;
  url?: string;
}

export interface Waiver {
  reason: string;
  path?: string;
}

export interface CheckResult {
  ruleId: string;
  domain: Domain;
  title: string;
  description: string;
  status: CheckStatus;
  severity: Severity;
  weight: number;
  evidence: Evidence[];
  remediation?: string;
  documentationUrl?: string;
  waiver?: Waiver;
}

export interface DomainResult {
  domain: Domain;
  score: number | null;
  confidence: number;
  earnedWeight: number;
  evaluatedWeight: number;
  possibleWeight: number;
  checks: CheckResult[];
}

export type ReadinessLabel = "ready" | "stable" | "developing" | "insufficient-data";

export interface OverallResult {
  score: number | null;
  confidence: number;
  label: ReadinessLabel;
}

export type FileCategory =
  | "source"
  | "test"
  | "manifest"
  | "workflow"
  | "documentation"
  | "configuration"
  | "other";

export interface FileRecord {
  path: string;
  size: number;
  extension: string;
  category: FileCategory;
}

export type ManifestKind =
  | "npm"
  | "python"
  | "go"
  | "rust"
  | "ruby"
  | "dotnet"
  | "java"
  | "unknown";

export interface EntrypointRecord {
  name: string;
  target: string;
  exists: boolean;
}

export interface ManifestRecord {
  path: string;
  kind: ManifestKind;
  name?: string;
  scripts: string[];
  entrypoints: EntrypointRecord[];
  dependencyCount: number;
  developmentDependencyCount: number;
  parseError?: string;
}

export type PermissionLevel = "none" | "read" | "write";
export type WorkflowPermissions = "read-all" | "write-all" | Record<string, PermissionLevel>;

export interface ActionReference {
  value: string;
  repository?: string;
  ref?: string;
  local: boolean;
  docker: boolean;
  pinnedToCommit: boolean;
}

export interface UntrustedExpression {
  expression: string;
  path: string;
  job: string;
  step: number;
}

export interface WorkflowJob {
  id: string;
  permissions?: WorkflowPermissions;
  timeoutMinutes?: number;
  environment?: string;
  actionReferences: ActionReference[];
  qualitySignals: string[];
  untrustedExpressions: UntrustedExpression[];
}

export interface WorkflowRecord {
  path: string;
  name?: string;
  triggers: string[];
  permissions?: WorkflowPermissions;
  concurrency: boolean;
  jobs: WorkflowJob[];
  parseError?: string;
}

export interface TypeScriptFacts {
  used: boolean;
  configPath?: string;
  strict?: boolean;
}

export interface RepositoryFacts {
  sourceDirectories: string[];
  sourceFileCount: number;
  testFileCount: number;
  testConfigurationPaths: string[];
  lockfilePaths: string[];
  dependencyUpdatePaths: string[];
  documentationPaths: string[];
  issueTemplatePaths: string[];
  pullRequestTemplatePaths: string[];
  sensitiveFilePaths: string[];
  environmentExamplePaths: string[];
  typescript: TypeScriptFacts;
}

export interface GitHubRepositoryMetadata {
  owner: string;
  name: string;
  url: string;
  description?: string;
  defaultBranch?: string;
  visibility?: string;
  topics: string[];
  languages: Record<string, number>;
  hasIssues?: boolean;
  hasDiscussions?: boolean;
  communityHealthPercentage?: number;
  communityFiles: string[];
}

export interface CollectionSummary {
  fileCount: number;
  parsedBytes: number;
  skippedSymlinks: string[];
  skippedLargeFiles: string[];
  warnings: string[];
}

export interface RepositorySnapshot {
  root: string;
  repositoryName: string;
  files: FileRecord[];
  manifests: ManifestRecord[];
  workflows: WorkflowRecord[];
  facts: RepositoryFacts;
  collection: CollectionSummary;
  github?: GitHubRepositoryMetadata;
}

export interface FilesystemCollection {
  root: string;
  repositoryName: string;
  files: FileRecord[];
  manifests: ManifestRecord[];
  facts: RepositoryFacts;
  collection: CollectionSummary;
}

export interface ReportRepository {
  name: string;
  owner?: string;
  url?: string;
  description?: string;
  defaultBranch?: string;
  visibility?: string;
  topics: string[];
  languages: Record<string, number>;
}

export interface ReportSummary {
  pass: number;
  warn: number;
  fail: number;
  unknown: number;
  notApplicable: number;
  highFindings: number;
}

export interface ManiflightReport {
  schemaVersion: "1.0";
  tool: {
    name: "Maniflight";
    version: string;
  };
  repository: ReportRepository;
  generatedAt?: string;
  domains: Record<Domain, DomainResult>;
  overall: OverallResult;
  summary: ReportSummary;
}

export interface RunOptions {
  root?: string;
  repository?: string;
  token?: string;
  generatedAt?: string;
  requireGitHub?: boolean;
  configPath?: string;
}

export interface RunResult {
  snapshot: RepositorySnapshot;
  report: ManiflightReport;
  config: ManiflightConfig;
  configPath?: string;
}

export type Rule = (snapshot: RepositorySnapshot) => CheckResult;
