export interface PullRequestReference {
    owner: string;
    repo: string;
    number: number;
    repository: string;
}
export declare function parsePullRequestReference(value: string): PullRequestReference;
