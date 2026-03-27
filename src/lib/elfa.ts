/* ================================================================== */
/*  Elfa AI — Social Sentiment API                                     */
/* ================================================================== */

// Use proxy in both dev and production to avoid CORS
const BASE = "/elfa-api";

function headers(): HeadersInit {
  return {
    "x-elfa-api-key": String(import.meta.env.VITE_ELFA_API_KEY ?? ""),
    Accept: "application/json",
  };
}

export function hasElfaKey(): boolean {
  return Boolean(import.meta.env.VITE_ELFA_API_KEY);
}

/* ── Types ─────────────────────────────────────────────────────────── */

export interface TrendingToken {
  token: string;
  current_count: number;
  previous_count: number;
  change_percent: number;
}

export interface TopMention {
  tweetId: string;
  link: string;
  likeCount: number | null;
  repostCount: number | null;
  viewCount: number | null;
  mentionedAt: string;
  type: string;
  /** Extracted from link URL: https://x.com/{username}/status/... */
  username: string;
}

export interface TrendingNarrative {
  narrative: string;
  source_links: string[];
}

export interface TokenNews {
  tweetId: string;
  link: string;
  likeCount: number | null;
  repostCount: number | null;
  viewCount: number | null;
  mentionedAt: string;
  type: string;
  account: { username: string; isVerified: boolean };
}

/* ── API Calls ─────────────────────────────────────────────────────── */

export async function getTrendingTokens(
  timeWindow = "24h",
  pageSize = 10,
  minMentions = 5,
): Promise<TrendingToken[]> {
  const params = new URLSearchParams({
    timeWindow,
    pageSize: String(pageSize),
    minMentions: String(minMentions),
    page: "1",
  });
  const res = await fetch(`${BASE}/v2/aggregations/trending-tokens?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.data ?? [];
}

export async function getTopMentions(
  ticker: string,
  timeWindow = "24h",
  pageSize = 5,
): Promise<TopMention[]> {
  const params = new URLSearchParams({
    ticker,
    timeWindow,
    pageSize: String(pageSize),
    page: "1",
  });
  const res = await fetch(`${BASE}/v2/data/top-mentions?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const raw: Array<Record<string, unknown>> = json?.data ?? [];
  return raw.map((m) => {
    const link = String(m.link ?? "");
    // Extract username from https://x.com/{username}/status/...
    const match = link.match(/x\.com\/([^/]+)\//);
    return {
      tweetId: String(m.tweetId ?? ""),
      link,
      likeCount: m.likeCount as number | null,
      repostCount: m.repostCount as number | null,
      viewCount: m.viewCount as number | null,
      mentionedAt: String(m.mentionedAt ?? ""),
      type: String(m.type ?? ""),
      username: match ? match[1] : "unknown",
    } satisfies TopMention;
  });
}

export async function getTrendingNarratives(
  timeWindow = "24h",
): Promise<TrendingNarrative[]> {
  const params = new URLSearchParams({ timeWindow });
  const res = await fetch(`${BASE}/v2/data/trending-narratives?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.trending_narratives ?? [];
}

export interface KeywordMention {
  tweetId: string;
  link: string;
  likeCount: number | null;
  repostCount: number | null;
  viewCount: number | null;
  quoteCount: number | null;
  replyCount: number | null;
  bookmarkCount: number | null;
  mentionedAt: string;
  type: string;
  account: { username: string; isVerified: boolean };
}

export async function getKeywordMentions(
  keywords: string,
  timeWindow = "24h",
  pageSize = 8,
): Promise<KeywordMention[]> {
  const params = new URLSearchParams({
    keywords,
    timeWindow,
    pageSize: String(pageSize),
    page: "1",
  });
  const res = await fetch(`${BASE}/v2/data/keyword-mentions?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data ?? [];
}

export async function getTokenNews(
  ticker: string,
  timeWindow = "24h",
  pageSize = 5,
): Promise<TokenNews[]> {
  const params = new URLSearchParams({
    ticker,
    timeWindow,
    pageSize: String(pageSize),
    page: "1",
  });
  const res = await fetch(`${BASE}/v2/data/token-news?${params}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data ?? [];
}
