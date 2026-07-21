function isUnsafeCodePoint(value) {
    const codePoint = value.codePointAt(0) ?? 0;
    return (codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069));
}
export function sanitizeText(value, maximumLength = 160) {
    if (typeof value !== "string")
        return "";
    const cleaned = [...value]
        .map((character) => (isUnsafeCodePoint(character) ? " " : character))
        .join("")
        .replace(/\s+/gu, " ")
        .trim();
    if (cleaned.length <= maximumLength)
        return cleaned;
    return `${cleaned.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}
export function sanitizeUrl(value) {
    if (typeof value !== "string" || value.length > 4096)
        return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:")
            return undefined;
        if (url.username || url.password)
            return undefined;
        url.search = "";
        url.hash = "";
        const normalized = url.toString();
        return normalized.length <= 2048 ? normalized : undefined;
    }
    catch {
        return undefined;
    }
}
export function optionalSanitizedText(value, maximumLength = 160) {
    const text = sanitizeText(value, maximumLength);
    return text.length > 0 ? text : null;
}
//# sourceMappingURL=sanitize.js.map