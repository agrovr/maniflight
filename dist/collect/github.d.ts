import type { GitHubRepositoryMetadata } from "../model.js";
interface ApiResponse {
    data: unknown;
}
export interface GitHubApi {
    repos: {
        get(parameters: {
            owner: string;
            repo: string;
        }): Promise<ApiResponse>;
        listLanguages(parameters: {
            owner: string;
            repo: string;
        }): Promise<ApiResponse>;
        getCommunityProfileMetrics(parameters: {
            owner: string;
            repo: string;
        }): Promise<ApiResponse>;
    };
}
export interface GitHubCollection {
    metadata?: GitHubRepositoryMetadata;
    warnings: string[];
}
export interface GitHubCollectionOptions {
    token?: string;
    required?: boolean;
    client?: GitHubApi;
}
export declare function parseRepositorySlug(value: string): {
    owner: string;
    repo: string;
};
export declare function collectGitHub(repository: string, options?: GitHubCollectionOptions): Promise<GitHubCollection>;
export {};
