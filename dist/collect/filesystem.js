import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import createIgnore from "ignore";
import { DEFAULT_EXCLUDES } from "../config.js";
const SOURCE_EXTENSIONS = new Set([
    ".c",
    ".cc",
    ".cpp",
    ".cs",
    ".css",
    ".go",
    ".h",
    ".hpp",
    ".html",
    ".java",
    ".js",
    ".jsx",
    ".kt",
    ".kts",
    ".php",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sh",
    ".swift",
    ".ts",
    ".tsx",
    ".vue",
]);
const SOURCE_DIRECTORIES = new Set(["app", "apps", "cmd", "internal", "lib", "packages", "src"]);
const DOCUMENT_NAMES = new Set([
    "changelog.md",
    "code_of_conduct.md",
    "code-of-conduct.md",
    "contributing",
    "contributing.md",
    "license",
    "license.md",
    "license.txt",
    "readme",
    "readme.md",
    "readme.txt",
    "security",
    "security.md",
    "support",
    "support.md",
]);
const LOCKFILE_NAMES = new Set([
    "bun.lock",
    "bun.lockb",
    "cargo.lock",
    "gemfile.lock",
    "go.sum",
    "package-lock.json",
    "packages.lock.json",
    "pipfile.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "uv.lock",
    "yarn.lock",
]);
const TEST_CONFIG_NAMES = new Set([
    "jest.config.js",
    "jest.config.mjs",
    "jest.config.ts",
    "playwright.config.js",
    "playwright.config.ts",
    "pytest.ini",
    "tox.ini",
    "vitest.config.js",
    "vitest.config.mjs",
    "vitest.config.ts",
]);
function toPosix(value) {
    return value.split(sep).join("/");
}
function isInside(root, candidate) {
    const fromRoot = relative(root, candidate);
    return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}
function isTestPath(path) {
    const lower = path.toLowerCase();
    return (/(^|\/)(__tests__|tests?|specs?)(\/|$)/u.test(lower) || /\.(spec|test)\.[a-z0-9]+$/u.test(lower));
}
function isManifest(path) {
    const name = basename(path).toLowerCase();
    return (name === "package.json" ||
        name === "pyproject.toml" ||
        name === "requirements.txt" ||
        name === "go.mod" ||
        name === "cargo.toml" ||
        name === "gemfile" ||
        name === "pom.xml" ||
        name === "build.gradle" ||
        name === "build.gradle.kts" ||
        name.endsWith(".csproj"));
}
function classifyFile(path) {
    const lower = path.toLowerCase();
    const name = basename(lower);
    if (lower.startsWith(".github/workflows/") && /\.ya?ml$/u.test(lower))
        return "workflow";
    if (isManifest(lower))
        return "manifest";
    if (isTestPath(lower))
        return "test";
    if (DOCUMENT_NAMES.has(name) || lower.startsWith("docs/"))
        return "documentation";
    if (SOURCE_EXTENSIONS.has(extname(lower)))
        return "source";
    if (name.startsWith(".") || /\.(json|toml|ya?ml|ini|config\.[a-z]+)$/u.test(lower)) {
        return "configuration";
    }
    return "other";
}
function manifestKind(path) {
    const name = basename(path).toLowerCase();
    if (name === "package.json")
        return "npm";
    if (name === "pyproject.toml" || name === "requirements.txt")
        return "python";
    if (name === "go.mod")
        return "go";
    if (name === "cargo.toml")
        return "rust";
    if (name === "gemfile")
        return "ruby";
    if (name.endsWith(".csproj"))
        return "dotnet";
    if (name === "pom.xml" || name.startsWith("build.gradle"))
        return "java";
    return "unknown";
}
function collectEntrypointValues(value, prefix, output) {
    if (typeof value === "string") {
        output.set(prefix, value);
        return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
        return;
    for (const [key, nested] of Object.entries(value)) {
        collectEntrypointValues(nested, `${prefix}.${key}`, output);
    }
}
function normalizeEntrypointTarget(target) {
    const withoutPrefix = target.startsWith("./") ? target.slice(2) : target;
    return toPosix(withoutPrefix);
}
async function entrypointExists(root, repositoryPath) {
    const candidate = resolve(root, repositoryPath);
    if (!isInside(root, candidate))
        return false;
    try {
        const metadata = await lstat(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink())
            return false;
        return isInside(root, await realpath(candidate));
    }
    catch {
        return false;
    }
}
async function parseNpmManifest(root, path, source) {
    try {
        const parsed = JSON.parse(source);
        const scripts = parsed.scripts && typeof parsed.scripts === "object" && !Array.isArray(parsed.scripts)
            ? Object.keys(parsed.scripts).sort()
            : [];
        const targets = new Map();
        for (const field of ["main", "module", "types"]) {
            if (typeof parsed[field] === "string")
                targets.set(field, parsed[field]);
        }
        if (typeof parsed.bin === "string")
            targets.set("bin", parsed.bin);
        else if (parsed.bin && typeof parsed.bin === "object" && !Array.isArray(parsed.bin)) {
            for (const [name, target] of Object.entries(parsed.bin)) {
                if (typeof target === "string")
                    targets.set(`bin.${name}`, target);
            }
        }
        collectEntrypointValues(parsed.exports, "exports", targets);
        const manifestDirectory = toPosix(dirname(path));
        const entrypoints = await Promise.all([...targets.entries()]
            .filter(([, target]) => !target.includes("*") && !target.startsWith("node:"))
            .map(async ([name, target]) => {
            const normalizedTarget = normalizeEntrypointTarget(target);
            const repositoryPath = manifestDirectory === "."
                ? normalizedTarget
                : `${manifestDirectory}/${normalizedTarget}`.replaceAll("//", "/");
            return { name, target, exists: await entrypointExists(root, repositoryPath) };
        }));
        entrypoints.sort((left, right) => left.name.localeCompare(right.name));
        const dependencies = parsed.dependencies &&
            typeof parsed.dependencies === "object" &&
            !Array.isArray(parsed.dependencies)
            ? Object.keys(parsed.dependencies).length
            : 0;
        const developmentDependencies = parsed.devDependencies &&
            typeof parsed.devDependencies === "object" &&
            !Array.isArray(parsed.devDependencies)
            ? Object.keys(parsed.devDependencies).length
            : 0;
        return {
            path,
            kind: "npm",
            ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
            scripts,
            entrypoints,
            dependencyCount: dependencies,
            developmentDependencyCount: developmentDependencies,
        };
    }
    catch {
        return {
            path,
            kind: "npm",
            scripts: [],
            entrypoints: [],
            dependencyCount: 0,
            developmentDependencyCount: 0,
            parseError: "package.json is not valid JSON",
        };
    }
}
function simpleManifest(path) {
    return {
        path,
        kind: manifestKind(path),
        scripts: [],
        entrypoints: [],
        dependencyCount: 0,
        developmentDependencyCount: 0,
    };
}
function isSensitiveFilename(path) {
    const name = basename(path).toLowerCase();
    if ([".env.example", ".env.sample", ".env.template"].includes(name))
        return false;
    return (name === ".env" ||
        name.startsWith(".env.") ||
        name === "id_rsa" ||
        name === "id_dsa" ||
        name === "credentials.json" ||
        name === "service-account.json" ||
        name === "secrets.yml" ||
        name === "secrets.yaml" ||
        name.endsWith(".key") ||
        name.endsWith(".p12") ||
        name.endsWith(".pfx"));
}
async function readBoundedText(root, file, config) {
    if (file.size > config.limits.maxFileBytes)
        return undefined;
    const candidate = resolve(root, file.path);
    const canonicalPath = await realpath(candidate);
    if (!isInside(root, canonicalPath))
        return undefined;
    const metadata = await lstat(canonicalPath);
    if (!metadata.isFile() || metadata.isSymbolicLink())
        return undefined;
    return readFile(canonicalPath, "utf8");
}
export async function collectFilesystem(root, config) {
    const canonicalRoot = await realpath(root);
    const rootMetadata = await lstat(canonicalRoot);
    if (!rootMetadata.isDirectory())
        throw new Error("Repository path must be a directory");
    const matcher = createIgnore();
    matcher.add([...DEFAULT_EXCLUDES]);
    matcher.add(config.exclude);
    const gitignorePath = resolve(canonicalRoot, ".gitignore");
    try {
        const metadata = await lstat(gitignorePath);
        if (metadata.isFile() &&
            !metadata.isSymbolicLink() &&
            metadata.size <= config.limits.maxFileBytes) {
            matcher.add(await readFile(gitignorePath, "utf8"));
        }
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const files = [];
    const skippedSymlinks = [];
    const skippedLargeFiles = [];
    async function walk(directory) {
        const entries = [];
        const handle = await opendir(directory);
        for await (const entry of handle)
            entries.push(entry);
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const absolutePath = resolve(directory, entry.name);
            const repositoryPath = toPosix(relative(canonicalRoot, absolutePath));
            const ignorePath = entry.isDirectory() ? `${repositoryPath}/` : repositoryPath;
            if (matcher.ignores(ignorePath))
                continue;
            if (entry.isSymbolicLink()) {
                skippedSymlinks.push(repositoryPath);
                continue;
            }
            if (entry.isDirectory()) {
                await walk(absolutePath);
                continue;
            }
            if (!entry.isFile())
                continue;
            const metadata = await lstat(absolutePath);
            if (!metadata.isFile() || metadata.isSymbolicLink())
                continue;
            files.push({
                path: repositoryPath,
                size: metadata.size,
                extension: extname(repositoryPath).toLowerCase(),
                category: classifyFile(repositoryPath),
            });
            if (metadata.size > config.limits.maxFileBytes)
                skippedLargeFiles.push(repositoryPath);
            if (files.length > config.limits.maxFiles) {
                throw new Error(`Repository exceeds the ${config.limits.maxFiles} file safety limit`);
            }
        }
    }
    await walk(canonicalRoot);
    files.sort((left, right) => left.path.localeCompare(right.path));
    skippedSymlinks.sort();
    skippedLargeFiles.sort();
    const manifestFiles = files.filter((file) => file.category === "manifest");
    const manifests = [];
    let parsedBytes = 0;
    for (const file of manifestFiles) {
        if (file.size > config.limits.maxFileBytes) {
            manifests.push({
                ...simpleManifest(file.path),
                parseError: "Manifest exceeds the file safety limit",
            });
            continue;
        }
        if (parsedBytes + file.size > config.limits.maxParsedBytes) {
            manifests.push({
                ...simpleManifest(file.path),
                parseError: "Parsed data safety limit reached",
            });
            continue;
        }
        const source = await readBoundedText(canonicalRoot, file, config);
        if (source === undefined) {
            manifests.push({
                ...simpleManifest(file.path),
                parseError: "Manifest could not be read safely",
            });
            continue;
        }
        parsedBytes += Buffer.byteLength(source);
        manifests.push(basename(file.path).toLowerCase() === "package.json"
            ? await parseNpmManifest(canonicalRoot, file.path, source)
            : simpleManifest(file.path));
    }
    const typeScriptFiles = files.filter((file) => [".ts", ".tsx"].includes(file.extension));
    const tsconfig = files.find((file) => basename(file.path).toLowerCase() === "tsconfig.json");
    let typescriptStrict;
    if (tsconfig &&
        tsconfig.size <= config.limits.maxFileBytes &&
        parsedBytes + tsconfig.size <= config.limits.maxParsedBytes) {
        const source = await readBoundedText(canonicalRoot, tsconfig, config);
        if (source !== undefined) {
            parsedBytes += Buffer.byteLength(source);
            typescriptStrict = /["']strict["']\s*:\s*true\b/u.test(source);
        }
    }
    const sourceFiles = files.filter((file) => file.category === "source");
    const testFiles = files.filter((file) => file.category === "test");
    const sourceDirectories = [...new Set(sourceFiles.map((file) => file.path.split("/")[0]))]
        .filter((directory) => directory !== undefined)
        .filter((directory) => directory && SOURCE_DIRECTORIES.has(directory.toLowerCase()))
        .sort();
    const documentationPaths = files
        .filter((file) => file.category === "documentation")
        .map((file) => file.path);
    return {
        root: canonicalRoot,
        repositoryName: basename(canonicalRoot),
        files,
        manifests: manifests.sort((left, right) => left.path.localeCompare(right.path)),
        facts: {
            sourceDirectories,
            sourceFileCount: sourceFiles.length,
            testFileCount: testFiles.length,
            testConfigurationPaths: files
                .filter((file) => TEST_CONFIG_NAMES.has(basename(file.path).toLowerCase()))
                .map((file) => file.path),
            lockfilePaths: files
                .filter((file) => LOCKFILE_NAMES.has(basename(file.path).toLowerCase()))
                .map((file) => file.path),
            dependencyUpdatePaths: files
                .filter((file) => [
                ".github/dependabot.yml",
                ".github/dependabot.yaml",
                ".renovaterc",
                "renovate.json",
                "renovate.json5",
            ].includes(file.path.toLowerCase()))
                .map((file) => file.path),
            documentationPaths,
            issueTemplatePaths: files
                .filter((file) => file.path.toLowerCase().startsWith(".github/issue_template/") &&
                !["config.yml", "config.yaml"].includes(basename(file.path).toLowerCase()))
                .map((file) => file.path),
            pullRequestTemplatePaths: files
                .filter((file) => basename(file.path).toLowerCase().startsWith("pull_request_template"))
                .map((file) => file.path),
            sensitiveFilePaths: files
                .filter((file) => isSensitiveFilename(file.path))
                .map((file) => file.path),
            environmentExamplePaths: files
                .filter((file) => [".env.example", ".env.sample", ".env.template"].includes(basename(file.path).toLowerCase()))
                .map((file) => file.path),
            typescript: {
                used: typeScriptFiles.length > 0 || tsconfig !== undefined,
                ...(tsconfig ? { configPath: tsconfig.path } : {}),
                ...(typescriptStrict === undefined ? {} : { strict: typescriptStrict }),
            },
        },
        collection: {
            fileCount: files.length,
            parsedBytes,
            skippedSymlinks,
            skippedLargeFiles,
            warnings: [],
        },
    };
}
//# sourceMappingURL=filesystem.js.map