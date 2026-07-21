import { classifyPullRequestFlight } from "./classify.js";
import { collectPullRequestFlight, type PullRequestFlightCollectionOptions } from "./collect.js";
import type { PullRequestFlightReport } from "./model.js";
import { parsePullRequestReference } from "./reference.js";

export interface RunPullRequestFlightOptions extends PullRequestFlightCollectionOptions {
  observedAt?: string;
}

export async function runPullRequestFlight(
  target: string,
  options: RunPullRequestFlightOptions = {},
): Promise<PullRequestFlightReport> {
  const reference = parsePullRequestReference(target);
  const facts = await collectPullRequestFlight(reference, options);
  return classifyPullRequestFlight(facts, options.observedAt ?? new Date().toISOString());
}
