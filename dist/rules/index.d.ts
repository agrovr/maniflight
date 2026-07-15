import type { CheckResult, RepositorySnapshot, Rule } from "../model.js";
export { architectureRules } from "./architecture.js";
export { automationRules } from "./automation.js";
export { communityRules } from "./community.js";
export { securityRules } from "./security.js";
export declare const RULES: Rule[];
export declare function evaluateRules(snapshot: RepositorySnapshot): CheckResult[];
