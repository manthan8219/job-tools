import { ScrapeQuery, ScrapeResult } from "./types.js";
import { logger } from "../utils/index.js";

/**
 * Common Adapter interface for all job scraping platforms.
 */
export interface JobScraperAdapter {
  readonly name: string;
  readonly source: string;

  /**
   * Check if adapter has required credentials / network configs (Himalayas requires none).
   */
  isConfigured(): boolean;

  /**
   * Perform scraping based on standard query parameters.
   */
  scrape(query: ScrapeQuery): Promise<ScrapeResult>;
}

/**
 * Abstract base class providing common error handling, logging, and execution safeguards.
 */
export abstract class BaseJobScraperAdapter implements JobScraperAdapter {
  abstract readonly name: string;
  abstract readonly source: string;

  abstract isConfigured(): boolean;

  protected abstract executeScrape(query: ScrapeQuery): Promise<ScrapeResult>;

  async scrape(query: ScrapeQuery): Promise<ScrapeResult> {
    logger.info(`[${this.name}] Starting scrape execution...`);

    if (!this.isConfigured()) {
      const message = `[${this.name}] Adapter is not properly configured.`;
      logger.warn(message);
      return {
        source: this.source,
        jobs: [],
        totalFound: 0,
        pagesFetched: 0,
        hasMore: false,
        fetchedAt: new Date(),
        error: message,
      };
    }

    try {
      const result = await this.executeScrape(query);
      logger.info(`[${this.name}] Finished scrape: found ${result.jobs.length} jobs (total available: ${result.totalFound}).`);
      return result;
    } catch (error: any) {
      const message = error?.message || String(error);
      logger.error(`[${this.name}] Scraping failed: ${message}`);
      return {
        source: this.source,
        jobs: [],
        totalFound: 0,
        pagesFetched: 0,
        hasMore: false,
        fetchedAt: new Date(),
        error: message,
      };
    }
  }
}
