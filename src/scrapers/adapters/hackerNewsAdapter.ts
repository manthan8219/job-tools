import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { logger } from "../../utils/index.js";

export interface HNItem {
  id: number;
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  kids?: number[];
  type?: string;
}

export class HackerNewsHiringAdapter extends BaseJobScraperAdapter {
  readonly name = "HackerNewsHiringAdapter";
  readonly source = "hackernews";

  private readonly timeoutMs: number;

  constructor(options?: { timeoutMs?: number }) {
    super();
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    logger.info(`[${this.name}] Fetching latest Hacker News 'Who is hiring?' thread...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Step 1: Find latest thread
      const userRes = await fetch("https://hacker-news.firebaseio.com/v0/user/whoishiring.json", {
        signal: controller.signal,
      });

      if (!userRes.ok) {
        throw new Error(`Failed to fetch whoishiring user profile (HTTP ${userRes.status})`);
      }

      const userData = (await userRes.json()) as { submitted?: number[] };
      const submittedIds = userData.submitted || [];

      let threadId: number | undefined;
      for (const id of submittedIds.slice(0, 5)) {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: controller.signal,
        });
        if (itemRes.ok) {
          const item = (await itemRes.json()) as HNItem;
          if (item.title && item.title.toLowerCase().includes("who is hiring")) {
            threadId = item.id;
            break;
          }
        }
      }

      if (!threadId) {
        return {
          source: this.source,
          jobs: [],
          totalFound: 0,
          hasMore: false,
          pagesFetched: 1,
          fetchedAt: new Date(),
        };
      }

      // Step 2: Fetch thread comments
      const threadRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${threadId}.json`, {
        signal: controller.signal,
      });
      const thread = (await threadRes.json()) as HNItem;
      const commentIds = thread.kids || [];

      const searchTerms = (query.query || query.titles?.join(" ") || "").toLowerCase().trim();
      const searchWords = searchTerms.split(/\s+/).filter(Boolean);

      const maxToScan = Math.min(commentIds.length, 60);
      const targetIds = commentIds.slice(0, maxToScan);

      const matchedJobs: ScrapedJob[] = [];

      // Fetch comments in parallel chunks of 10
      for (let i = 0; i < targetIds.length; i += 10) {
        const chunk = targetIds.slice(i, i + 10);
        const commentPromises = chunk.map(async (cId) => {
          try {
            const cRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${cId}.json`, {
              signal: controller.signal,
            });
            if (!cRes.ok) return null;
            return (await cRes.json()) as HNItem;
          } catch {
            return null;
          }
        });

        const comments = await Promise.all(commentPromises);

        for (const comment of comments) {
          if (!comment || !comment.text) continue;

          if (searchWords.length > 0) {
            const textLower = comment.text.toLowerCase();
            const matches = searchWords.every((word) => textLower.includes(word));
            if (!matches) continue;
          }

          const parsed = this.parseHNComment(comment);
          if (parsed) {
            if (query.worldwideOnly && parsed.workArrangement !== "remote") {
              continue;
            }
            matchedJobs.push(parsed);
          }
        }

        if (matchedJobs.length >= (query.limit ?? 20)) {
          break;
        }
      }

      const limit = query.limit ?? 20;
      const paginatedJobs = matchedJobs.slice(0, limit);

      return {
        source: this.source,
        jobs: paginatedJobs,
        totalFound: matchedJobs.length,
        hasMore: false,
        pagesFetched: 1,
        fetchedAt: new Date(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseHNComment(comment: HNItem): ScrapedJob | null {
    if (!comment.text) return null;

    // Decode HTML entities
    const rawText = comment.text
      .replace(/<p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&amp;/g, "&")
      .replace(/&#x2F;/g, "/")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');

    // Extract first line which typically contains: Company | Role | Location | Remote/Onsite | URL
    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    const parts = firstLine.split("|").map((p) => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean);

    const company = parts[0] || comment.by || "Hacker News Startup";
    const title = parts[1] || "Software Engineer";
    const location = parts[2] || "Remote / Unspecified";

    const isRemote =
      rawText.toLowerCase().includes("remote") ||
      firstLine.toLowerCase().includes("remote");

    // Extract URL if present
    const urlMatch = /href="([^"]+)"/i.exec(comment.text);
    const applyUrl = urlMatch ? urlMatch[1] : `https://news.ycombinator.com/item?id=${comment.id}`;

    return {
      id: `hn-${comment.id}`,
      title,
      company,
      location: isRemote && !location.toLowerCase().includes("remote") ? `${location} (Remote)` : location,
      description: rawText,
      url: applyUrl,
      source: this.source,
      employmentType: "full-time",
      workArrangement: isRemote ? "remote" : "on-site",
      postedAt: comment.time ? new Date(comment.time * 1000) : undefined,
      scrapedAt: new Date(),
      rawData: comment as unknown as Record<string, unknown>,
    };
  }
}
