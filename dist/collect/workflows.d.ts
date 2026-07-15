import type { ManiflightConfig } from "../config.js";
import type { FileRecord, WorkflowRecord } from "../model.js";
export interface WorkflowCollection {
    workflows: WorkflowRecord[];
    parsedBytes: number;
    warnings: string[];
}
export declare function collectWorkflows(root: string, files: FileRecord[], config: ManiflightConfig, alreadyParsedBytes?: number): Promise<WorkflowCollection>;
