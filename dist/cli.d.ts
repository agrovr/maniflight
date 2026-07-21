#!/usr/bin/env node
import type { PullRequestFlightReport } from "./pr/model.js";
export interface CliDependencies {
    inspectPullRequest?: (target: string, options: {
        token?: string;
        observedAt: string;
    }) => Promise<PullRequestFlightReport>;
    now?: () => Date;
}
export declare function runCli(arguments_?: string[], dependencies?: CliDependencies): Promise<void>;
