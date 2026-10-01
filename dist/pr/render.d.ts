import type { PullRequestFlightReport } from "./model.js";
export interface RenderPullRequestFlightOptions {
    /** Add ANSI color to Maniflight's own labels. Remote text is never colored or passed through. */
    color?: boolean;
}
export declare function renderPullRequestFlight(report: PullRequestFlightReport, options?: RenderPullRequestFlightOptions): string;
/** Color only for an interactive terminal, honoring the NO_COLOR and FORCE_COLOR conventions. */
export declare function shouldUseColor(stream: {
    isTTY?: boolean;
}, env?: Record<string, string | undefined>): boolean;
