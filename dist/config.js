import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parseDocument } from "yaml";
import { z } from "zod";
const safeRelativePath = z
    .string()
    .min(1)
    .max(300)
    .refine((value) => !value.includes("\0"), "Path cannot contain a null byte")
    .refine((value) => !isAbsolute(value), "Path must be relative");
const waiverSchema = z.object({
    rule: z.string().min(1).max(120),
    paths: z.array(safeRelativePath).max(50).default([]),
    reason: z.string().min(8).max(500),
});
export const maniflightConfigSchema = z.object({
    version: z.literal(1).default(1),
    exclude: z.array(safeRelativePath).max(100).default([]),
    limits: z
        .object({
        maxFiles: z.number().int().min(100).max(100_000).default(25_000),
        maxFileBytes: z
            .number()
            .int()
            .min(1_024)
            .max(10 * 1_024 * 1_024)
            .default(1_048_576),
        maxParsedBytes: z
            .number()
            .int()
            .min(1_024)
            .max(100 * 1_024 * 1_024)
            .default(20_971_520),
    })
        .default({
        maxFiles: 25_000,
        maxFileBytes: 1_048_576,
        maxParsedBytes: 20_971_520,
    }),
    github: z
        .object({
        enabled: z.boolean().default(true),
    })
        .default({ enabled: true }),
    thresholds: z
        .object({
        failUnder: z.number().int().min(0).max(100).nullable().default(null),
        failOnHigh: z.boolean().default(false),
    })
        .default({ failUnder: null, failOnHigh: false }),
    ignore: z.array(waiverSchema).max(100).default([]),
});
export const DEFAULT_EXCLUDES = [
    ".git/",
    "node_modules/",
    "vendor/",
    "dist/",
    "build/",
    "coverage/",
    ".next/",
    ".nuxt/",
    ".svelte-kit/",
    ".turbo/",
    ".cache/",
    "target/",
    "__pycache__/",
];
function isWithinRoot(root, candidate) {
    const fromRoot = relative(root, candidate);
    return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}
export async function loadConfig(root, configPath = ".maniflight.yml") {
    const resolvedRoot = await realpath(root);
    const candidate = resolve(resolvedRoot, configPath);
    if (!isWithinRoot(resolvedRoot, candidate)) {
        throw new Error(`Configuration path must remain inside the repository: ${configPath}`);
    }
    let metadata;
    try {
        metadata = await lstat(candidate);
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return { config: maniflightConfigSchema.parse({}) };
        }
        throw error;
    }
    if (metadata.isSymbolicLink()) {
        throw new Error("Configuration files cannot be symbolic links");
    }
    if (!metadata.isFile()) {
        throw new Error("Configuration path must refer to a regular file");
    }
    if (metadata.size > 256 * 1_024) {
        throw new Error("Configuration file exceeds the 256 KiB safety limit");
    }
    const canonicalPath = await realpath(candidate);
    if (!isWithinRoot(resolvedRoot, canonicalPath)) {
        throw new Error("Configuration file resolves outside the repository");
    }
    const source = await readFile(canonicalPath, "utf8");
    const document = parseDocument(source, {
        prettyErrors: true,
        uniqueKeys: true,
    });
    if (document.errors.length > 0) {
        throw new Error(`Invalid Maniflight configuration: ${document.errors[0]?.message}`);
    }
    const parsed = document.toJS({ maxAliasCount: 20 });
    return {
        config: maniflightConfigSchema.parse(parsed ?? {}),
        path: relative(resolvedRoot, canonicalPath).replaceAll("\\", "/"),
    };
}
//# sourceMappingURL=config.js.map