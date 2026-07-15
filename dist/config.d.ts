import { z } from "zod";
export declare const maniflightConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    exclude: z.ZodDefault<z.ZodArray<z.ZodString>>;
    limits: z.ZodDefault<z.ZodObject<{
        maxFiles: z.ZodDefault<z.ZodNumber>;
        maxFileBytes: z.ZodDefault<z.ZodNumber>;
        maxParsedBytes: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    github: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    thresholds: z.ZodDefault<z.ZodObject<{
        failUnder: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        failOnHigh: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    ignore: z.ZodDefault<z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        paths: z.ZodDefault<z.ZodArray<z.ZodString>>;
        reason: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ManiflightConfig = z.infer<typeof maniflightConfigSchema>;
export declare const DEFAULT_EXCLUDES: readonly [".git/", "node_modules/", "vendor/", "dist/", "build/", "coverage/", ".next/", ".nuxt/", ".svelte-kit/", ".turbo/", ".cache/", "target/", "__pycache__/"];
export interface LoadedConfig {
    config: ManiflightConfig;
    path?: string;
}
export declare function loadConfig(root: string, configPath?: string): Promise<LoadedConfig>;
