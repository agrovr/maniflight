import { VERSION } from "../version.js";
const ACTOR_ORDER = [
    "contributor",
    "reviewer",
    "maintainer",
    "automation",
    "external",
    "wait",
    "unknown",
];
const SIGNAL_STATUS_ORDER = {
    blocked: 0,
    action_required: 1,
    waiting: 2,
    unknown: 3,
    info: 4,
    pass: 5,
};
const SUCCESSFUL_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
const FAILED_CONCLUSIONS = new Set([
    "failure",
    "error",
    "timed_out",
    "cancelled",
    "stale",
    "startup_failure",
]);
const WAITING_STATES = new Set(["requested", "queued", "in_progress", "pending", "waiting"]);
function signal(input) {
    return {
        id: input.id,
        status: input.status,
        actor: input.actor,
        confidence: input.confidence ?? "observed",
        blocking: input.blocking,
        summary: input.summary,
        ...(input.detail ? { detail: input.detail } : {}),
        evidence: input.evidence ?? [],
    };
}
function compareText(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function evidence(label, url) {
    return url ? [{ label, url }] : [];
}
function requiredContext(policy, name, appId, source) {
    const appRules = policy?.requiredStatusCheckApps?.filter((rule) => rule.context === name) ?? [];
    if (appRules.length > 0) {
        return appRules.some((rule) => rule.integrationId === null ||
            (source === "check" &&
                appId !== null &&
                appId !== undefined &&
                rule.integrationId === appId));
    }
    return policy?.requiredStatusChecks.some((context) => context === name) ?? false;
}
function checkSignal(check, policy) {
    const required = requiredContext(policy, check.name, check.appId, "check");
    const state = (check.conclusion ?? check.status).toLowerCase();
    const link = evidence("Check run", check.url);
    if (SUCCESSFUL_CONCLUSIONS.has(state)) {
        return signal({
            id: `check/${check.id}`,
            status: "pass",
            actor: "automation",
            blocking: false,
            summary: `${check.name} ${state}`,
            evidence: link,
        });
    }
    if (WAITING_STATES.has(state)) {
        return signal({
            id: `check/${check.id}`,
            status: "waiting",
            actor: "automation",
            blocking: required,
            summary: `${check.name} is ${state.replaceAll("_", " ")}`,
            ...(required ? { detail: "This check matches an active required status context." } : {}),
            evidence: link,
        });
    }
    if (state === "action_required") {
        return signal({
            id: `check/${check.id}`,
            status: "action_required",
            actor: "unknown",
            confidence: "unknown",
            blocking: required,
            summary: `${check.name} requires manual action`,
            evidence: link,
        });
    }
    if (FAILED_CONCLUSIONS.has(state)) {
        return signal({
            id: `check/${check.id}`,
            status: required ? "blocked" : "action_required",
            actor: "unknown",
            confidence: "unknown",
            blocking: required,
            summary: `${check.name} ${state.replaceAll("_", " ")}`,
            detail: required
                ? "This check matches an active required status context."
                : "GitHub did not identify this as an active required context.",
            evidence: link,
        });
    }
    return signal({
        id: `check/${check.id}`,
        status: "unknown",
        actor: "unknown",
        confidence: "unknown",
        blocking: required,
        summary: `${check.name} has an unrecognized result`,
        detail: state || "No status was reported.",
        evidence: link,
    });
}
function statusSignal(status, policy) {
    const required = requiredContext(policy, status.context, null, "status");
    const state = status.state.toLowerCase();
    const isKnownContributorGate = /^(?:license\/cla|dco)$/iu.test(status.context);
    const actor = isKnownContributorGate ? "contributor" : "unknown";
    const confidence = isKnownContributorGate ? "inferred" : "unknown";
    const link = evidence("Commit status", status.url);
    if (state === "success") {
        return signal({
            id: `status/${status.id}`,
            status: "pass",
            actor: isKnownContributorGate ? "external" : "automation",
            confidence: isKnownContributorGate ? "inferred" : "observed",
            blocking: false,
            summary: `${status.context} reports success`,
            ...(isKnownContributorGate
                ? {
                    detail: "This reports the provider's status; it is not a legal-compliance conclusion.",
                }
                : {}),
            evidence: link,
        });
    }
    if (state === "pending") {
        return signal({
            id: `status/${status.id}`,
            status: "waiting",
            actor: "automation",
            blocking: required,
            summary: `${status.context} is pending`,
            evidence: link,
        });
    }
    if (state === "failure" || state === "error") {
        return signal({
            id: `status/${status.id}`,
            status: required ? "blocked" : "action_required",
            actor,
            confidence,
            blocking: required,
            summary: `${status.context} reports ${state}`,
            evidence: link,
        });
    }
    return signal({
        id: `status/${status.id}`,
        status: "unknown",
        actor: "unknown",
        confidence: "unknown",
        blocking: required,
        summary: `${status.context} has an unrecognized state`,
        detail: state,
        evidence: link,
    });
}
function hiddenActionRequiredWorkflowSignal(workflow, isFork) {
    const link = evidence("Workflow run", workflow.url);
    const maintainerApproval = isFork && workflow.event === "pull_request";
    return signal({
        id: `workflow/${workflow.id}`,
        status: "action_required",
        actor: maintainerApproval ? "maintainer" : "unknown",
        confidence: maintainerApproval ? "inferred" : "unknown",
        blocking: false,
        summary: `${workflow.name} requires manual action`,
        detail: maintainerApproval
            ? "GitHub reports manual action required for this fork workflow, and the run has no jobs. A maintainer with write access is the likely next actor."
            : "GitHub reports manual action required for a run with no jobs, but does not expose a reliable next actor.",
        evidence: link,
    });
}
function outcomeSummary(status, subject) {
    const summaries = {
        ready: "No observed blocker remains in the collected evidence.",
        ready_with_warnings: "No observed merge blocker remains, but non-blocking attention is useful.",
        blocked: "One or more observed conditions currently block the pull request.",
        action_required: "A person needs to act before automated progress can continue.",
        waiting: "Automation or another pending condition is still running.",
        unknown: "The available evidence is not complete enough to declare this pull request ready.",
        merged: `Pull request #${subject.number} is merged.`,
        closed: `Pull request #${subject.number} is closed without a merge.`,
    };
    return summaries[status];
}
function actionForSignal(value) {
    if (value.status === "pass" || value.status === "info")
        return null;
    if (value.status === "unknown" && value.id !== "pr/mergeability")
        return null;
    const summaries = {
        "pr/draft": "Mark the pull request ready for review when the work is ready.",
        "pr/mergeability": value.status === "unknown"
            ? "Wait for GitHub to finish computing mergeability, then inspect again."
            : value.summary.includes("updated")
                ? "Update the branch with the current base branch."
                : "Resolve the merge conflict.",
        "review/decision": value.actor === "contributor"
            ? "Address the requested review changes."
            : "Review and approve the pull request if it meets the project requirements.",
        "review/threads": "Resolve the required review conversations.",
    };
    return {
        actor: value.actor,
        summary: summaries[value.id] ?? value.summary,
        ...(value.evidence[0] ? { url: value.evidence[0].url } : {}),
    };
}
export function classifyPullRequestFlight(facts, observedAt) {
    const { subject } = facts;
    const prEvidence = evidence("Pull request", subject.url);
    const signals = [];
    signals.push(signal({
        id: "pr/state",
        status: subject.merged ? "pass" : subject.state === "closed" ? "info" : "pass",
        actor: subject.merged || subject.state === "closed" ? "unknown" : "automation",
        blocking: false,
        summary: subject.merged
            ? "Pull request is merged"
            : subject.state === "closed"
                ? "Pull request is closed without a merge"
                : "Pull request is open",
        evidence: prEvidence,
    }));
    if (!subject.merged && subject.state === "open") {
        signals.push(signal({
            id: "pr/draft",
            status: subject.draft ? "action_required" : "pass",
            actor: subject.draft ? "contributor" : "automation",
            blocking: subject.draft,
            summary: subject.draft
                ? "Pull request is still a draft"
                : "Pull request is ready for review",
            evidence: prEvidence,
        }));
        const mergeState = subject.mergeState?.toLowerCase() ?? null;
        const conflict = subject.mergeable === false || mergeState === "dirty";
        const behind = mergeState === "behind" && facts.branchPolicy?.requireUpToDate === true;
        if (conflict) {
            signals.push(signal({
                id: "pr/mergeability",
                status: "blocked",
                actor: "contributor",
                blocking: true,
                summary: "The pull request has a merge conflict",
                evidence: prEvidence,
            }));
        }
        else if (behind) {
            signals.push(signal({
                id: "pr/mergeability",
                status: "action_required",
                actor: "contributor",
                blocking: true,
                summary: "The branch must be updated with the base branch",
                evidence: prEvidence,
            }));
        }
        else if (subject.mergeable === null || mergeState === "unknown" || mergeState === null) {
            signals.push(signal({
                id: "pr/mergeability",
                status: "unknown",
                actor: "wait",
                confidence: "unknown",
                blocking: false,
                summary: "GitHub has not finished computing mergeability",
                evidence: prEvidence,
            }));
        }
        else if (mergeState === "unstable") {
            signals.push(signal({
                id: "pr/mergeability",
                status: "info",
                actor: "automation",
                blocking: false,
                summary: "GitHub reports an unstable merge state",
                detail: "The pull request is mergeable, but non-required checks may still need attention.",
                evidence: prEvidence,
            }));
        }
        else {
            signals.push(signal({
                id: "pr/mergeability",
                status: "pass",
                actor: "automation",
                blocking: false,
                summary: "Pull request is mergeable",
                evidence: prEvidence,
            }));
        }
        const decision = subject.reviewDecision?.toUpperCase() ?? null;
        const latestDecisiveReviews = new Map();
        for (const review of facts.reviews) {
            const state = review.state.toUpperCase();
            if (state === "APPROVED" || state === "CHANGES_REQUESTED") {
                latestDecisiveReviews.set(review.user, state);
            }
            else if (state === "DISMISSED") {
                latestDecisiveReviews.delete(review.user);
            }
        }
        const hasChangesRequested = [...latestDecisiveReviews.values()].includes("CHANGES_REQUESTED");
        const approvals = [...latestDecisiveReviews.values()].filter((state) => state === "APPROVED").length;
        const requiredApprovals = facts.branchPolicy?.requiredApprovals;
        const reviewsComplete = facts.collection.find((source) => source.id === "reviews")?.status === "available";
        if (decision === null && hasChangesRequested) {
            signals.push(signal({
                id: "review/visible-changes-requested",
                status: "info",
                actor: "contributor",
                confidence: "inferred",
                blocking: false,
                summary: "A visible review requested changes",
                detail: "GitHub did not confirm whether this review is still an active merge requirement.",
                evidence: prEvidence,
            }));
        }
        if (decision === "CHANGES_REQUESTED") {
            signals.push(signal({
                id: "review/decision",
                status: "blocked",
                actor: "contributor",
                blocking: true,
                summary: "A reviewer requested changes",
                evidence: prEvidence,
            }));
        }
        else if (decision === "REVIEW_REQUIRED" ||
            (decision === null &&
                reviewsComplete &&
                typeof requiredApprovals === "number" &&
                approvals < requiredApprovals)) {
            signals.push(signal({
                id: "review/decision",
                status: "blocked",
                actor: "reviewer",
                confidence: decision === "REVIEW_REQUIRED" ? "observed" : "inferred",
                blocking: true,
                summary: typeof requiredApprovals === "number" && requiredApprovals > 0
                    ? `${requiredApprovals} approving review${requiredApprovals === 1 ? " is" : "s are"} required`
                    : "An approving review is required",
                evidence: prEvidence,
            }));
        }
        else if (decision === "APPROVED") {
            signals.push(signal({
                id: "review/decision",
                status: "pass",
                actor: "reviewer",
                blocking: false,
                summary: "GitHub reports the review requirement is approved",
                evidence: prEvidence,
            }));
        }
        else if (decision === null &&
            facts.collection.every((source) => !["graphql", "reviews", "branch_rules"].includes(source.id) ||
                source.status === "available") &&
            (facts.branchPolicy === null ||
                (requiredApprovals === 0 &&
                    facts.branchPolicy.requireCodeOwnerReview === false &&
                    facts.branchPolicy.requireLastPushApproval === false))) {
            signals.push(signal({
                id: "review/decision",
                status: "pass",
                actor: "reviewer",
                confidence: "inferred",
                blocking: false,
                summary: "No active review requirement was observed",
                evidence: prEvidence,
            }));
        }
        else {
            signals.push(signal({
                id: "review/decision",
                status: "unknown",
                actor: "unknown",
                confidence: "unknown",
                blocking: false,
                summary: "Review requirements could not be determined conclusively",
                evidence: prEvidence,
            }));
        }
        if (facts.reviewThreads) {
            const required = facts.branchPolicy?.requireThreadResolution === true;
            const unresolved = facts.reviewThreads.unresolved;
            const threadsComplete = facts.collection.find((source) => source.id === "graphql")?.status === "available";
            signals.push(signal({
                id: "review/threads",
                status: unresolved > 0 ? (required ? "blocked" : "info") : threadsComplete ? "pass" : "unknown",
                actor: unresolved > 0 ? "contributor" : threadsComplete ? "automation" : "unknown",
                confidence: unresolved === 0 && !threadsComplete ? "unknown" : "observed",
                blocking: required && unresolved > 0,
                summary: unresolved === 0 && threadsComplete
                    ? "No unresolved review threads were observed"
                    : unresolved === 0
                        ? "Review thread evidence was incomplete"
                        : `${unresolved} review thread${unresolved === 1 ? " is" : "s are"} unresolved`,
                ...(unresolved > 0 && !required
                    ? {
                        detail: "The active branch rules did not identify conversation resolution as required.",
                    }
                    : {}),
                evidence: prEvidence,
            }));
        }
        signals.push(...facts.checkRuns.map((check) => checkSignal(check, facts.branchPolicy)));
        signals.push(...facts.commitStatuses.map((status) => statusSignal(status, facts.branchPolicy)));
        const isFork = subject.head.repository.toLowerCase() !== subject.base.repository.toLowerCase();
        const hiddenActionRequiredRuns = facts.workflowRuns.filter((run) => (run.conclusion ?? run.status).toLowerCase() === "action_required" && run.jobs === 0);
        signals.push(...hiddenActionRequiredRuns.map((run) => hiddenActionRequiredWorkflowSignal(run, isFork)));
        const requiredChecks = facts.branchPolicy?.requiredStatusCheckApps ??
            (facts.branchPolicy?.requiredStatusChecks ?? []).map((context) => ({
                context,
                integrationId: null,
            }));
        const checkRunsComplete = facts.collection.find((source) => source.id === "check_runs")?.status === "available";
        const commitStatusesComplete = facts.collection.find((source) => source.id === "commit_statuses")?.status === "available";
        for (const requirement of requiredChecks) {
            const observed = facts.checkRuns.some((check) => check.name === requirement.context &&
                (requirement.integrationId === null || check.appId === requirement.integrationId)) ||
                (requirement.integrationId === null &&
                    facts.commitStatuses.some((status) => status.context === requirement.context));
            if (!observed) {
                const evidenceComplete = checkRunsComplete && (requirement.integrationId !== null || commitStatusesComplete);
                signals.push(signal({
                    id: `required-status/${requirement.context}/${requirement.integrationId ?? "any"}`,
                    status: evidenceComplete ? "waiting" : "unknown",
                    actor: evidenceComplete ? "automation" : "unknown",
                    confidence: evidenceComplete ? "inferred" : "unknown",
                    blocking: evidenceComplete,
                    summary: evidenceComplete
                        ? `${requirement.context} is required but has not reported a result`
                        : `${requirement.context} requirement could not be verified from incomplete check evidence`,
                    evidence: prEvidence,
                }));
            }
        }
        const modeledBlocker = signals.some((value) => value.blocking && value.status !== "pass" && value.status !== "info");
        if (mergeState === "blocked" && !modeledBlocker) {
            signals.push(signal({
                id: "pr/unexplained-blocker",
                status: "unknown",
                actor: "unknown",
                confidence: "unknown",
                blocking: true,
                summary: "GitHub reports the pull request is blocked for an unexplained reason",
                evidence: prEvidence,
            }));
        }
        for (const source of facts.collection) {
            if (source.id === "pull_request" || source.status === "available")
                continue;
            signals.push(signal({
                id: `collection/${source.id}`,
                status: "unknown",
                actor: "unknown",
                confidence: "unknown",
                blocking: false,
                summary: `${source.id.replaceAll("_", " ")} evidence is ${source.status.replaceAll("_", " ")}`,
                ...(source.detail ? { detail: source.detail } : {}),
                evidence: [],
            }));
        }
    }
    signals.sort((left, right) => SIGNAL_STATUS_ORDER[left.status] - SIGNAL_STATUS_ORDER[right.status] ||
        compareText(left.id, right.id));
    const counts = {
        blocked: signals.filter((value) => value.status === "blocked").length,
        actionRequired: signals.filter((value) => value.status === "action_required").length,
        waiting: signals.filter((value) => value.status === "waiting").length,
        unknown: signals.filter((value) => value.status === "unknown").length,
    };
    let status;
    if (subject.merged)
        status = "merged";
    else if (subject.state === "closed")
        status = "closed";
    else if (signals.some((value) => value.blocking && (value.status === "blocked" || value.status === "action_required"))) {
        status = "blocked";
    }
    else if (counts.actionRequired > 0)
        status = "action_required";
    else if (counts.waiting > 0)
        status = "waiting";
    else if (counts.unknown > 0)
        status = "unknown";
    else if (signals.some((value) => value.status === "info"))
        status = "ready_with_warnings";
    else
        status = "ready";
    const nextActors = ACTOR_ORDER.filter((actor) => signals.some((value) => value.actor === actor &&
        value.status !== "pass" &&
        value.status !== "info" &&
        value.actor !== "unknown"));
    if (status !== "ready" &&
        status !== "ready_with_warnings" &&
        status !== "merged" &&
        status !== "closed" &&
        nextActors.length === 0) {
        nextActors.push("unknown");
    }
    const nextActions = signals
        .map(actionForSignal)
        .filter((value) => value !== null)
        .filter((value, index, all) => all.findIndex((candidate) => candidate.actor === value.actor && candidate.summary === value.summary) === index);
    return {
        kind: "pull-request-flight",
        schemaVersion: "1.0",
        tool: { name: "Maniflight", version: VERSION },
        observedAt,
        pullRequest: subject,
        outcome: {
            status,
            nextActors,
            summary: outcomeSummary(status, subject),
        },
        counts,
        signals,
        nextActions,
        collection: {
            sources: [...facts.collection].sort((left, right) => compareText(left.id, right.id)),
            warnings: [...facts.warnings].sort(),
        },
    };
}
//# sourceMappingURL=classify.js.map