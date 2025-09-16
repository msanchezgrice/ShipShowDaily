import { setTimeout as setTimeoutPromise } from "timers/promises";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "ShipShowScraper/1.0 (+https://shipshow.io)";

export type VideoSourceType = "file" | "hls" | "unknown";

export interface ScrapedVideoSource {
  url: string;
  type: VideoSourceType;
  label?: string;
  mimeType?: string;
}

export interface ScrapeResult {
  originalUrl: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  tags: string[];
  videoSources: ScrapedVideoSource[];
  durationSeconds?: number;
}

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeError";
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    const lower = entity.toLowerCase();
    switch (lower) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
      case "#39":
        return "'";
      case "nbsp":
        return " ";
      default:
        if (lower.startsWith("#x")) {
          const codePoint = Number.parseInt(lower.slice(2), 16);
          if (!Number.isNaN(codePoint)) {
            return String.fromCodePoint(codePoint);
          }
        } else if (lower.startsWith("#")) {
          const codePoint = Number.parseInt(lower.slice(1), 10);
          if (!Number.isNaN(codePoint)) {
            return String.fromCodePoint(codePoint);
          }
        }
        return `&${entity};`;
    }
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*("[^"]*"|'[^']*')/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(tag)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue = match[2];
    const value = rawValue.slice(1, -1);
    attributes[name] = decodeHtmlEntities(value.trim());
  }

  return attributes;
}

function toAbsoluteUrl(baseUrl: string, possibleUrl?: string): string | undefined {
  if (!possibleUrl) return undefined;
  try {
    return new URL(possibleUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function inferVideoType(url: string, mimeType?: string): VideoSourceType {
  const normalizedUrl = url.toLowerCase();
  const normalizedMime = mimeType?.toLowerCase() ?? "";

  if (normalizedMime.includes("m3u8") || normalizedUrl.includes(".m3u8")) {
    return "hls";
  }

  if (
    normalizedMime.includes("mp4") ||
    normalizedMime.includes("webm") ||
    normalizedMime.includes("quicktime") ||
    normalizedUrl.includes(".mp4") ||
    normalizedUrl.includes(".webm") ||
    normalizedUrl.includes(".mov") ||
    normalizedUrl.includes(".m4v")
  ) {
    return "file";
  }

  return "unknown";
}

function parseISODuration(value: string): number | undefined {
  const isoRegex = /P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/i;
  const match = isoRegex.exec(value);
  if (!match) {
    return undefined;
  }
  const hours = match[1] ? Number.parseFloat(match[1]) : 0;
  const minutes = match[2] ? Number.parseFloat(match[2]) : 0;
  const seconds = match[3] ? Number.parseFloat(match[3]) : 0;
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.round(totalSeconds) : undefined;
}

function addDurationCandidate(value: unknown, container: number[]): void {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    container.push(Math.round(value));
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;

    const directNumber = Number.parseFloat(trimmed);
    if (Number.isFinite(directNumber) && directNumber > 0) {
      container.push(Math.round(directNumber));
      return;
    }

    const isoDuration = parseISODuration(trimmed);
    if (isoDuration) {
      container.push(isoDuration);
    }
  }
}

function collectKeywords(rawValue: unknown, keywords: Set<string>): void {
  if (!rawValue) return;

  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      collectKeywords(item, keywords);
    }
    return;
  }

  if (typeof rawValue !== "string") return;

  const parts = rawValue
    .split(/[,|#]/)
    .map(part => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.length <= 50) {
      keywords.add(part);
    } else {
      keywords.add(part.slice(0, 50));
    }
  }
}

interface VideoSourceDraft {
  url: string;
  type: VideoSourceType;
  label?: string;
  mimeType?: string;
}

function addVideoSource(
  baseUrl: string,
  value: string | undefined,
  options: { label?: string; mimeType?: string; explicitType?: VideoSourceType } | undefined,
  container: Map<string, VideoSourceDraft>,
): void {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:")) return;

  const absolute = toAbsoluteUrl(baseUrl, decodeHtmlEntities(trimmed));
  if (!absolute) return;

  const normalized = absolute.replace(/&amp;/g, "&");

  if (container.has(normalized)) {
    const existing = container.get(normalized)!;
    if (options?.label && !existing.label) {
      existing.label = options.label;
    }
    if (options?.mimeType && !existing.mimeType) {
      existing.mimeType = options.mimeType;
    }
    if (options?.explicitType && existing.type === "unknown") {
      existing.type = options.explicitType;
    }
    return;
  }

  const type = options?.explicitType ?? inferVideoType(normalized, options?.mimeType);
  container.set(normalized, {
    url: normalized,
    type,
    label: options?.label,
    mimeType: options?.mimeType,
  });
}

function processJsonLdNode(
  node: any,
  baseUrl: string,
  titleCandidates: string[],
  descriptionCandidates: string[],
  thumbnailCandidates: string[],
  keywords: Set<string>,
  videoDrafts: Map<string, VideoSourceDraft>,
  durationCandidates: number[],
  visited: Set<any>,
): void {
  if (!node || typeof node !== "object") return;
  if (visited.has(node)) return;
  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      processJsonLdNode(
        item,
        baseUrl,
        titleCandidates,
        descriptionCandidates,
        thumbnailCandidates,
        keywords,
        videoDrafts,
        durationCandidates,
        visited,
      );
    }
    return;
  }

  const typeValue = (node["@type"] || node["type"])?.toString().toLowerCase();

  if (typeValue === "videoobject") {
    if (typeof node.name === "string") {
      titleCandidates.push(node.name.trim());
    }
    if (typeof node.description === "string") {
      descriptionCandidates.push(node.description.trim());
    }
    if (node.thumbnailUrl) {
      const thumb = Array.isArray(node.thumbnailUrl) ? node.thumbnailUrl[0] : node.thumbnailUrl;
      if (typeof thumb === "string") {
        const absoluteThumb = toAbsoluteUrl(baseUrl, thumb.trim());
        if (absoluteThumb) {
          thumbnailCandidates.push(absoluteThumb);
        }
      }
    }
    if (node.duration) {
      addDurationCandidate(node.duration, durationCandidates);
    }
    if (node.encodingFormat && typeof node.encodingFormat === "string") {
      // Encoding format may help refine mime type later
    }
    if (node.contentUrl && typeof node.contentUrl === "string") {
      addVideoSource(
        baseUrl,
        node.contentUrl,
        {
          label: typeof node.name === "string" ? node.name : "Video",
          mimeType: typeof node.encodingFormat === "string" ? node.encodingFormat : undefined,
        },
        videoDrafts,
      );
    }
    if (node.embedUrl && typeof node.embedUrl === "string") {
      const inferredType = inferVideoType(node.embedUrl, typeof node.encodingFormat === "string" ? node.encodingFormat : undefined);
      if (inferredType !== "unknown") {
        addVideoSource(
          baseUrl,
          node.embedUrl,
          {
            label: typeof node.name === "string" ? node.name : "Video",
            mimeType: typeof node.encodingFormat === "string" ? node.encodingFormat : undefined,
            explicitType: inferredType,
          },
          videoDrafts,
        );
      }
    }
    if (node.keywords) {
      collectKeywords(node.keywords, keywords);
    }
  }

  if (typeValue === "product") {
    if (typeof node.name === "string") {
      titleCandidates.push(node.name.trim());
    }
    if (typeof node.description === "string") {
      descriptionCandidates.push(node.description.trim());
    }
    if (node.image) {
      const imageValue = Array.isArray(node.image) ? node.image[0] : node.image;
      if (typeof imageValue === "string") {
        const absolute = toAbsoluteUrl(baseUrl, imageValue);
        if (absolute) {
          thumbnailCandidates.push(absolute);
        }
      }
    }
    if (node.brand && typeof node.brand === "object" && typeof node.brand.name === "string") {
      collectKeywords(node.brand.name, keywords);
    }
  }

  // Recursively process known nested properties that may contain useful info
  const nestedKeys = [
    "video",
    "hasVideo",
    "itemListElement",
    "associatedMedia",
    "subjectOf",
    "mentions",
    "offers",
    "potentialAction",
    "mainEntity",
  ];

  for (const key of nestedKeys) {
    if (key in node) {
      processJsonLdNode(
        node[key],
        baseUrl,
        titleCandidates,
        descriptionCandidates,
        thumbnailCandidates,
        keywords,
        videoDrafts,
        durationCandidates,
        visited,
      );
    }
  }

  // As a fallback, traverse any object properties that are likely to contain nested JSON-LD
  for (const value of Object.values(node)) {
    if (typeof value === "object" && value !== null) {
      processJsonLdNode(
        value,
        baseUrl,
        titleCandidates,
        descriptionCandidates,
        thumbnailCandidates,
        keywords,
        videoDrafts,
        durationCandidates,
        visited,
      );
    }
  }
}

function chooseFirst<T>(values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = (value as string).trim();
      if (trimmed) return trimmed as T;
    } else if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return undefined;
}

export async function scrapeProductPage(targetUrl: string): Promise<ScrapeResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new ScrapeError("Invalid URL provided. Please enter a valid URL including the protocol (e.g., https://example.com)");
  }

  const controller = new AbortController();
  const timeoutPromise = setTimeoutPromise(FETCH_TIMEOUT_MS, undefined, { signal: controller.signal }).catch(() => {
    controller.abort();
  });

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ScrapeError("Timed out while trying to load the page. Please try again or use a different URL.");
    }
    throw new ScrapeError(`Failed to fetch the provided URL: ${error?.message ?? "Unknown error"}`);
  } finally {
    controller.abort();
    await timeoutPromise.catch(() => undefined);
  }

  if (!response.ok) {
    throw new ScrapeError(`Failed to fetch the provided URL (status ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new ScrapeError("The provided URL does not appear to be an HTML page.");
  }

  const html = await response.text();

  const titleCandidates: string[] = [];
  const descriptionCandidates: string[] = [];
  const thumbnailCandidates: string[] = [];
  const keywords = new Set<string>();
  const videoDrafts = new Map<string, VideoSourceDraft>();
  const durationCandidates: number[] = [];

  const metaRegex = /<meta\b[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;

  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = parseAttributes(metaMatch[0]);
    const name = attrs["name"]?.toLowerCase();
    const property = attrs["property"]?.toLowerCase();
    const itemprop = attrs["itemprop"]?.toLowerCase();
    const content = attrs["content"]?.trim();

    if (!content) continue;

    if (property === "og:title" || name === "twitter:title" || itemprop === "name" || name === "title") {
      titleCandidates.push(content);
    }

    if (
      property === "og:description" ||
      name === "description" ||
      name === "twitter:description" ||
      itemprop === "description" ||
      property === "product:description"
    ) {
      descriptionCandidates.push(content);
    }

    if (
      property === "og:image" ||
      property === "og:image:url" ||
      name === "twitter:image" ||
      itemprop === "image" ||
      itemprop === "thumbnailurl"
    ) {
      const absolute = toAbsoluteUrl(parsedUrl.toString(), content);
      if (absolute) {
        thumbnailCandidates.push(absolute);
      }
    }

    if (name === "keywords" || itemprop === "keywords") {
      collectKeywords(content, keywords);
    }

    if (property?.endsWith(":tag") || name?.endsWith(":tag")) {
      collectKeywords(content, keywords);
    }

    if (property === "og:video" || property === "og:video:url" || property === "og:video:secure_url") {
      addVideoSource(parsedUrl.toString(), content, { label: "OpenGraph video" }, videoDrafts);
    }

    if (property === "og:video:type" || name === "twitter:player:stream:content_type") {
      // Could refine MIME type if paired with URL later
    }

    if (property === "og:video:duration" || property === "video:duration" || name === "duration") {
      addDurationCandidate(content, durationCandidates);
    }

    if (name === "twitter:player:stream" || name === "twitter:player:stream:src") {
      addVideoSource(parsedUrl.toString(), content, { label: "Twitter video" }, videoDrafts);
    }
  }

  const linkRegex = /<link\b[^>]*>/gi;
  let canonicalUrl: string | undefined;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const attrs = parseAttributes(linkMatch[0]);
    const rel = attrs["rel"]?.toLowerCase();
    if (rel === "canonical" && attrs["href"]) {
      const absolute = toAbsoluteUrl(parsedUrl.toString(), attrs["href"]);
      if (absolute) {
        canonicalUrl = absolute;
        break;
      }
    }
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch && titleMatch[1]) {
    titleCandidates.push(decodeHtmlEntities(titleMatch[1].trim()));
  }

  const videoBlockRegex = /<video\b([\s\S]*?)<\/video>/gi;
  let videoMatch: RegExpExecArray | null;
  let inlineVideoIndex = 0;

  while ((videoMatch = videoBlockRegex.exec(html)) !== null) {
    inlineVideoIndex += 1;
    const videoTag = `<video${videoMatch[1]}>`;
    const videoAttrs = parseAttributes(videoTag);
    if (videoAttrs["poster"]) {
      const absolutePoster = toAbsoluteUrl(parsedUrl.toString(), videoAttrs["poster"]);
      if (absolutePoster) {
        thumbnailCandidates.push(absolutePoster);
      }
    }
    if (videoAttrs["src"]) {
      addVideoSource(
        parsedUrl.toString(),
        videoAttrs["src"],
        { label: `Inline video ${inlineVideoIndex}` },
        videoDrafts,
      );
    }

    const sources = videoMatch[0].match(/<source\b[^>]*>/gi) ?? [];
    let sourceIndex = 0;
    for (const sourceTag of sources) {
      sourceIndex += 1;
      const sourceAttrs = parseAttributes(sourceTag);
      if (sourceAttrs["src"]) {
        addVideoSource(
          parsedUrl.toString(),
          sourceAttrs["src"],
          {
            label: sourceAttrs["label"] ?? `Video source ${inlineVideoIndex}.${sourceIndex}`,
            mimeType: sourceAttrs["type"],
          },
          videoDrafts,
        );
      }
    }
  }

  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch: RegExpExecArray | null;

  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    const raw = jsonMatch[1]?.trim();
    if (!raw) continue;

    const cleaned = raw.replace(/<!--([\s\S]*?)-->/g, "").trim();
    if (!cleaned) continue;

    const candidates = [cleaned];
    if (!cleaned.startsWith("[") && !cleaned.endsWith("]")) {
      candidates.push(`[${cleaned}]`);
    }

    let parsedJson: any = undefined;
    for (const candidate of candidates) {
      try {
        parsedJson = JSON.parse(candidate);
        break;
      } catch {
        continue;
      }
    }

    if (parsedJson) {
      processJsonLdNode(
        parsedJson,
        parsedUrl.toString(),
        titleCandidates,
        descriptionCandidates,
        thumbnailCandidates,
        keywords,
        videoDrafts,
        durationCandidates,
        new Set<any>(),
      );
    }
  }

  const directVideoRegex = /https?:\/\/[\w.-]+(?:\/[\w\-./%?=&]*)?\.(?:mp4|m3u8|webm|mov|m4v)(?:\?[^"'\s<>]*)?/gi;
  let directMatch: RegExpExecArray | null;
  while ((directMatch = directVideoRegex.exec(html)) !== null) {
    const candidate = directMatch[0];
    addVideoSource(parsedUrl.toString(), candidate, { label: "Detected video" }, videoDrafts);
  }

  const durationMetaRegex = /data-duration\s*=\s*("[^"]*"|'[^']*')/gi;
  let durationMatch: RegExpExecArray | null;
  while ((durationMatch = durationMetaRegex.exec(html)) !== null) {
    const value = durationMatch[1]?.slice(1, -1);
    if (value) {
      addDurationCandidate(value, durationCandidates);
    }
  }

  const title = chooseFirst(titleCandidates);
  const description = chooseFirst(descriptionCandidates);
  const thumbnailUrl = chooseFirst(thumbnailCandidates);
  const durationSeconds = chooseFirst(durationCandidates);

  const filteredVideos = Array.from(videoDrafts.values()).filter(source => source.type !== "unknown");

  filteredVideos.sort((a, b) => {
    if (a.type === b.type) return 0;
    if (a.type === "file" && b.type === "hls") return -1;
    if (a.type === "hls" && b.type === "file") return 1;
    if (a.type === "file") return -1;
    if (b.type === "file") return 1;
    return 0;
  });

  const uniqueTags = Array.from(keywords).slice(0, 20);

  return {
    originalUrl: parsedUrl.toString(),
    canonicalUrl,
    title,
    description,
    thumbnailUrl,
    tags: uniqueTags,
    videoSources: filteredVideos,
    durationSeconds,
  };
}
