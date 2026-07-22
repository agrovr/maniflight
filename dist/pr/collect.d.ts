import type { PullRequestFlightFacts } from "./model.js";
import type { PullRequestReference } from "./reference.js";
export interface PullRequestApiResponse {
    data: unknown;
    headers?: Readonly<Record<string, string | number | undefined>>;
}
export interface PullRequestApi {
    request(route: string, parameters: Readonly<Record<string, unknown>>): Promise<PullRequestApiResponse>;
    graphql?(query: string, variables: Readonly<Record<string, unknown>>): Promise<unknown>;
}
export interface PullRequestFlightCollectionOptions {
    token?: string;
    client?: PullRequestApi;
}
export type PullRequestCollectionOptions = PullRequestFlightCollectionOptions;
export declare function collectPullRequestFlight(reference: PullRequestReference, options?: PullRequestFlightCollectionOptions): Promise<PullRequestFlightFacts>;
