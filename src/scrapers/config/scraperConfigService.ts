import {
  ScraperConfig,
  SupportedTitle,
  SupportedCountry,
  SupportedSource,
} from "./scraperConfigModel.js";
import { ScraperConfigRepository } from "./scraperConfigRepository.js";
import { logger } from "../../utils/index.js";

export class ScraperConfigService {
  constructor(private repository = new ScraperConfigRepository()) {}

  /**
   * Returns the current scraper configuration from MongoDB.
   */
  async getConfig(): Promise<ScraperConfig> {
    return await this.repository.getConfig();
  }

  /**
   * Returns the list of supported job titles.
   */
  async getSupportedTitles(onlyEnabled = true): Promise<SupportedTitle[]> {
    const config = await this.repository.getConfig();
    return onlyEnabled ? config.supportedTitles.filter((t) => t.enabled) : config.supportedTitles;
  }

  /**
   * Returns the list of supported countries.
   */
  async getSupportedCountries(onlyEnabled = true): Promise<SupportedCountry[]> {
    const config = await this.repository.getConfig();
    return onlyEnabled ? config.supportedCountries.filter((c) => c.enabled) : config.supportedCountries;
  }

  /**
   * Returns the list of active scraper sources.
   */
  async getActiveSources(): Promise<SupportedSource[]> {
    const config = await this.repository.getConfig();
    return config.supportedSources.filter((s) => s.enabled);
  }

  /**
   * Checks whether a given role title is supported according to MongoDB configuration.
   */
  async isTitleSupported(queryTitle?: string): Promise<boolean> {
    if (!queryTitle) return false;
    const match = await this.findMatchingTitle(queryTitle);
    return Boolean(match);
  }

  /**
   * Finds the best matching SupportedTitle object for a user query string.
   */
  async findMatchingTitle(queryTitle: string): Promise<SupportedTitle | null> {
    const titles = await this.getSupportedTitles(true);
    const clean = queryTitle.toLowerCase().trim();

    for (const item of titles) {
      if (item.title.toLowerCase() === clean || item.slug.toLowerCase() === clean) {
        return item;
      }
      if (item.aliases.some((alias) => clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean))) {
        return item;
      }
    }

    return null;
  }

  /**
   * Checks whether a given country is supported according to MongoDB configuration.
   */
  async isCountrySupported(countryQuery?: string): Promise<boolean> {
    if (!countryQuery) return false;
    const match = await this.findMatchingCountry(countryQuery);
    return Boolean(match);
  }

  /**
   * Finds the best matching SupportedCountry object for a country query string.
   */
  async findMatchingCountry(countryQuery: string): Promise<SupportedCountry | null> {
    const countries = await this.getSupportedCountries(true);
    const clean = countryQuery.toLowerCase().trim();

    for (const item of countries) {
      if (item.code.toLowerCase() === clean || item.name.toLowerCase() === clean) {
        return item;
      }
      if (item.aliases.some((alias) => alias.toLowerCase() === clean || clean.includes(alias.toLowerCase()))) {
        return item;
      }
    }

    return null;
  }

  /**
   * Adds a new supported job title into MongoDB.
   */
  async addSupportedTitle(titleInput: SupportedTitle): Promise<ScraperConfig> {
    logger.info(`[ScraperConfigService] Registering new supported title '${titleInput.title}' into MongoDB`);
    return await this.repository.addSupportedTitle(titleInput);
  }

  /**
   * Adds a new supported country into MongoDB.
   */
  async addSupportedCountry(countryInput: SupportedCountry): Promise<ScraperConfig> {
    logger.info(`[ScraperConfigService] Registering new supported country '${countryInput.name}' (${countryInput.code}) into MongoDB`);
    return await this.repository.addSupportedCountry(countryInput);
  }

  /**
   * Enables or disables a scraper source in MongoDB.
   */
  async toggleSource(sourceKey: string, enabled: boolean): Promise<ScraperConfig> {
    logger.info(`[ScraperConfigService] Toggling scraper source '${sourceKey}' enabled=${enabled} in MongoDB`);
    return await this.repository.toggleSource(sourceKey, enabled);
  }

  /**
   * Resets MongoDB configuration to default.
   */
  async resetToDefaults(): Promise<ScraperConfig> {
    return await this.repository.resetToDefaults();
  }
}
