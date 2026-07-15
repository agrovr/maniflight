import { type CheckResult, type Domain, type DomainResult, type ManiflightReport, type OverallResult, type RepositorySnapshot } from "../model.js";
export declare const DOMAIN_WEIGHTS: Record<Domain, number>;
export declare function scoreDomain(domain: Domain, checks: CheckResult[]): DomainResult;
export declare function scoreOverall(domains: Record<Domain, DomainResult>): OverallResult;
export declare function buildReport(snapshot: RepositorySnapshot, checks: CheckResult[], options: {
    version: string;
    generatedAt?: string;
}): ManiflightReport;
