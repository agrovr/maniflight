export type FlightActor =
  | "contributor"
  | "maintainer"
  | "reviewer"
  | "automation"
  | "external"
  | "wait"
  | "unknown";

export type ActorConfidence = "observed" | "inferred" | "unknown";

export type SignalStatus = "pass" | "blocked" | "action_required" | "waiting" | "unknown" | "info";

export type FlightOutcome =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "action_required"
  | "waiting"
  | "unknown"
  | "merged"
  | "closed";

export type CollectionStatus = "available" | "partial" | "unavailable" | "not_attempted";

export type CollectionSourceId =
  | "pull_request"
  | "graphql"
  | "reviews"
  | "check_runs"
  | "commit_statuses"
  | "workflow_runs"
  | "branch_rules";

export interface EvidenceLink {
  label: string;
  url: string;
}

export interface CollectionSource {
  id: CollectionSourceId;
  status: CollectionStatus;
  detail?: string;
}

export interface PullRequestSubject {
  repository: string;
  number: number;
  url: string;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  author: string;
  base: {
    ref: string;
    sha: string;
    repository: string;
  };
  head: {
    ref: string;
    sha: string;
    repository: string;
  };
  mergeable: boolean | null;
  mergeState: string | null;
  reviewDecision: string | null;
}

export interface ReviewFact {
  id: number;
  user: string;
  state: string;
  submittedAt: string | null;
  url: string;
}

export interface CheckRunFact {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  app: string | null;
  appId?: number | null;
  url: string;
}

export interface CommitStatusFact {
  id: number;
  context: string;
  state: string;
  creator: string | null;
  url: string;
}

export interface WorkflowRunFact {
  id: number;
  name: string;
  event: string;
  status: string;
  conclusion: string | null;
  jobs: number | null;
  url: string;
}

export interface BranchPolicyFact {
  requiredApprovals: number | null;
  requireCodeOwnerReview: boolean | null;
  requireLastPushApproval: boolean | null;
  requireThreadResolution: boolean | null;
  requireUpToDate: boolean | null;
  requiredStatusChecks: string[];
  requiredStatusCheckApps?: Array<{
    context: string;
    integrationId: number | null;
  }>;
}

export interface ReviewThreadFact {
  total: number;
  unresolved: number;
}

export interface PullRequestFlightFacts {
  subject: PullRequestSubject;
  reviews: ReviewFact[];
  checkRuns: CheckRunFact[];
  commitStatuses: CommitStatusFact[];
  workflowRuns: WorkflowRunFact[];
  branchPolicy: BranchPolicyFact | null;
  reviewThreads: ReviewThreadFact | null;
  collection: CollectionSource[];
  warnings: string[];
}

export interface FlightSignal {
  id: string;
  status: SignalStatus;
  actor: FlightActor;
  confidence: ActorConfidence;
  blocking: boolean;
  summary: string;
  detail?: string;
  evidence: EvidenceLink[];
}

export interface FlightAction {
  actor: FlightActor;
  summary: string;
  url?: string;
}

export interface PullRequestFlightReport {
  kind: "pull-request-flight";
  schemaVersion: "1.0";
  tool: {
    name: "Maniflight";
    version: string;
  };
  observedAt: string;
  pullRequest: PullRequestSubject;
  outcome: {
    status: FlightOutcome;
    nextActors: FlightActor[];
    summary: string;
  };
  counts: {
    blocked: number;
    actionRequired: number;
    waiting: number;
    unknown: number;
  };
  signals: FlightSignal[];
  nextActions: FlightAction[];
  collection: {
    sources: CollectionSource[];
    warnings: string[];
  };
}
