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
/**
 * Whether this module is the program being run. Package managers start the CLI through a
 * symlink (for example `bin/maniflight -> .../dist/cli.js`), so the invoked path is resolved
 * before comparing it with this module's real location.
 */
export declare function isDirectInvocation(invokedPath: string | undefined, moduleUrl?: string): boolean;
