import type { ManiflightReport } from "../model.js";
export declare const RENDER_DOMAINS: readonly ["architecture", "automation", "security", "community"];
export type RenderDomain = (typeof RENDER_DOMAINS)[number];
export declare const DOMAIN_LABELS: Readonly<Record<RenderDomain, string>>;
/** Decorative connective tissue for the HTML controls layered above it. */
export declare function renderConstellationSvg(): string;
/**
 * A self-contained summary artifact for CLI consumers that request SVG output.
 * It contains no scripts, remote fonts, images, or runtime network references.
 */
export declare function renderReportSvg(report: ManiflightReport): string;
export declare function statusSymbol(status: string): string;
