import { type ManiflightConfig } from "../config.js";
import type { FilesystemCollection } from "../model.js";
export declare function collectFilesystem(root: string, config: ManiflightConfig): Promise<FilesystemCollection>;
