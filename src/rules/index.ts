import type { CheckResult, RepositorySnapshot, Rule } from "../model.js";
import { architectureRules } from "./architecture.js";
import { automationRules } from "./automation.js";
import { communityRules } from "./community.js";
import { securityRules } from "./security.js";

export { architectureRules } from "./architecture.js";
export { automationRules } from "./automation.js";
export { communityRules } from "./community.js";
export { securityRules } from "./security.js";

export const RULES: Rule[] = [
  ...architectureRules,
  ...automationRules,
  ...securityRules,
  ...communityRules,
];

export function evaluateRules(snapshot: RepositorySnapshot): CheckResult[] {
  return RULES.map((rule) => rule(snapshot));
}
