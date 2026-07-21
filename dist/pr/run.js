import { classifyPullRequestFlight } from "./classify.js";
import { collectPullRequestFlight } from "./collect.js";
import { parsePullRequestReference } from "./reference.js";
export async function runPullRequestFlight(target, options = {}) {
    const reference = parsePullRequestReference(target);
    const facts = await collectPullRequestFlight(reference, options);
    return classifyPullRequestFlight(facts, options.observedAt ?? new Date().toISOString());
}
//# sourceMappingURL=run.js.map