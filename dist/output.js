import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { renderReportHtml } from "./render/html.js";
import { renderReportSvg } from "./render/svg.js";
function isWithin(base, candidate) {
    const fromBase = relative(base, candidate);
    return fromBase === "" || (!fromBase.startsWith("..") && !isAbsolute(fromBase));
}
async function prepareOutputDirectory(outputDirectory, allowedRoot) {
    const directory = resolve(outputDirectory);
    const root = allowedRoot ? resolve(allowedRoot) : undefined;
    if (root && !isWithin(root, directory)) {
        throw new Error(`Output directory must remain inside ${root}`);
    }
    if (root) {
        const rootMetadata = await lstat(root);
        if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
            throw new Error("Allowed output root must be a real directory");
        }
        let cursor = root;
        const segments = relative(root, directory)
            .split(/[\\/]+/)
            .filter(Boolean);
        for (const segment of segments) {
            cursor = resolve(cursor, segment);
            try {
                const metadata = await lstat(cursor);
                if (metadata.isSymbolicLink()) {
                    throw new Error("Output directory cannot contain symbolic-link ancestors");
                }
                if (!metadata.isDirectory()) {
                    throw new Error("Output path must be a directory");
                }
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    throw error;
                await mkdir(cursor);
            }
        }
    }
    else {
        try {
            const metadata = await lstat(directory);
            if (metadata.isSymbolicLink()) {
                throw new Error("Output directory cannot be a symbolic link");
            }
            if (!metadata.isDirectory()) {
                throw new Error("Output path must be a directory");
            }
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            await mkdir(directory, { recursive: true });
        }
    }
    const canonicalDirectory = await realpath(directory);
    if (root) {
        const canonicalRoot = await realpath(root);
        if (!isWithin(canonicalRoot, canonicalDirectory)) {
            throw new Error("Output directory resolves outside the allowed root");
        }
    }
    return canonicalDirectory;
}
async function writeArtifact(path, contents) {
    try {
        const metadata = await lstat(path);
        if (metadata.isSymbolicLink()) {
            throw new Error(`Report artifact cannot be a symbolic link: ${path}`);
        }
        if (!metadata.isFile()) {
            throw new Error(`Report artifact path must be a regular file: ${path}`);
        }
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const temporary = resolve(dirname(path), `.maniflight-${randomUUID()}-${path.endsWith(".json") ? "report.json" : "artifact.tmp"}`);
    try {
        await writeFile(temporary, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });
        await rename(temporary, path);
    }
    finally {
        await rm(temporary, { force: true }).catch(() => undefined);
    }
}
export async function writeReportArtifacts(report, outputDirectory, allowedRoot) {
    const directory = await prepareOutputDirectory(outputDirectory, allowedRoot);
    const html = resolve(directory, "report.html");
    const json = resolve(directory, "report.json");
    const svg = resolve(directory, "orbit.svg");
    await Promise.all([
        writeArtifact(html, `${renderReportHtml(report)}\n`),
        writeArtifact(json, `${JSON.stringify(report, null, 2)}\n`),
        writeArtifact(svg, `${renderReportSvg(report)}\n`),
    ]);
    return { directory, html, json, svg };
}
//# sourceMappingURL=output.js.map