import { type PullRequestFlightCollectionOptions } from "./collect.js";
import type { PullRequestFlightReport } from "./model.js";
export interface RunPullRequestFlightOptions extends PullRequestFlightCollectionOptions {
    observedAt?: string;
}
export declare function runPullRequestFlight(target: string, options?: RunPullRequestFlightOptions): Promise<PullRequestFlightReport>;
