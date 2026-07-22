import { parseRepositorySlug } from "../collect/github.js";
function isForbiddenCodePoint(value) {
    const codePoint = value.codePointAt(0) ?? 0;
    return (codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069));
}
export function parsePullRequestReference(value) {
    if (value !== value.trim() || [...value].some(isForbiddenCodePoint)) {
        throw new Error("Pull request must use the owner/repository#number format");
    }
    const separator = value.lastIndexOf("#");
    if (separator <= 0 || separator !== value.indexOf("#")) {
        throw new Error("Pull request must use the owner/repository#number format");
    }
    const repository = value.slice(0, separator);
    const numberText = value.slice(separator + 1);
    if (!/^[1-9]\d*$/u.test(numberText)) {
        throw new Error("Pull request number must be a positive integer");
    }
    const number = Number(numberText);
    if (!Number.isSafeInteger(number)) {
        throw new Error("Pull request number is too large");
    }
    const { owner, repo } = parseRepositorySlug(repository);
    return { owner, repo, number, repository: `${owner}/${repo}` };
}
//# sourceMappingURL=reference.js.map