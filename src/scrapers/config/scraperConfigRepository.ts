import { Db } from "mongodb";
import { getMongoDb } from "../../db/index.js";
import { logger } from "../../utils/index.js";
import {
  ScraperConfig,
  ScraperConfigSchema,
  DEFAULT_SCRAPER_CONFIG,
  SupportedTitle,
  SupportedCountry,
} from "./scraperConfigModel.js";

export const SCRAPER_CONFIG_COLLECTION = "scraper_configurations";

export class ScraperConfigRepository {
  private db?: Db;

  constructor(db?: Db) {
    this.db = db;
  }

  private async getDb(): Promise<Db> {
    if (this.db) return this.db;
    return await getMongoDb();
  }

  /**
   * Retrieves the current scraper configuration.
   * If no configuration exists in MongoDB, it automatically seeds and persists the default configuration.
   */
  async getConfig(id = "default"): Promise<ScraperConfig> {
    const db = await this.getDb();
    const collection = db.collection<ScraperConfig>(SCRAPER_CONFIG_COLLECTION);

    const doc = await collection.findOne({ id }, { projection: { _id: 0 } });

    if (!doc) {
      logger.info(`[ScraperConfigRepository] No configuration found with id '${id}'. Seeding defaults into MongoDB...`);
      const seededConfig: ScraperConfig = {
        ...DEFAULT_SCRAPER_CONFIG,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await collection.insertOne({ ...seededConfig } as any);
      return ScraperConfigSchema.parse(seededConfig);
    }

    return ScraperConfigSchema.parse(doc);
  }

  /**
   * Updates or overwrites fields in the scraper configuration.
   */
  async updateConfig(
    updates: Partial<Omit<ScraperConfig, "id" | "createdAt">> & { id?: string }
  ): Promise<ScraperConfig> {
    const db = await this.getDb();
    const collection = db.collection<ScraperConfig>(SCRAPER_CONFIG_COLLECTION);
    const id = updates.id || "default";

    const current = await this.getConfig(id);
    const updated: ScraperConfig = {
      ...current,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    const validated = ScraperConfigSchema.parse(updated);

    await collection.updateOne(
      { id },
      { $set: { ...validated } },
      { upsert: true }
    );

    return validated;
  }

  /**
   * Dynamically adds or updates a supported job title in the MongoDB configuration.
   */
  async addSupportedTitle(titleInput: SupportedTitle, id = "default"): Promise<ScraperConfig> {
    const current = await this.getConfig(id);
    const existingIndex = current.supportedTitles.findIndex(
      (t) => t.slug.toLowerCase() === titleInput.slug.toLowerCase() || t.title.toLowerCase() === titleInput.title.toLowerCase()
    );

    let updatedTitles: SupportedTitle[];
    if (existingIndex >= 0) {
      updatedTitles = [...current.supportedTitles];
      updatedTitles[existingIndex] = titleInput;
    } else {
      updatedTitles = [...current.supportedTitles, titleInput];
    }

    return await this.updateConfig({
      id,
      supportedTitles: updatedTitles,
    });
  }

  /**
   * Dynamically adds or updates a supported country in the MongoDB configuration.
   */
  async addSupportedCountry(countryInput: SupportedCountry, id = "default"): Promise<ScraperConfig> {
    const current = await this.getConfig(id);
    const existingIndex = current.supportedCountries.findIndex(
      (c) => c.code.toUpperCase() === countryInput.code.toUpperCase()
    );

    let updatedCountries: SupportedCountry[];
    if (existingIndex >= 0) {
      updatedCountries = [...current.supportedCountries];
      updatedCountries[existingIndex] = countryInput;
    } else {
      updatedCountries = [...current.supportedCountries, countryInput];
    }

    return await this.updateConfig({
      id,
      supportedCountries: updatedCountries,
    });
  }

  /**
   * Toggles whether a scraper source is active in MongoDB.
   */
  async toggleSource(sourceKey: string, enabled: boolean, id = "default"): Promise<ScraperConfig> {
    const current = await this.getConfig(id);
    const updatedSources = current.supportedSources.map((s) =>
      s.source.toLowerCase() === sourceKey.toLowerCase() ? { ...s, enabled } : s
    );

    // If source doesn't exist yet in the list, append it
    if (!updatedSources.some((s) => s.source.toLowerCase() === sourceKey.toLowerCase())) {
      updatedSources.push({
        source: sourceKey.toLowerCase(),
        name: sourceKey,
        enabled,
      });
    }

    return await this.updateConfig({
      id,
      supportedSources: updatedSources,
    });
  }

  /**
   * Resets the MongoDB configuration back to the canonical defaults.
   */
  async resetToDefaults(id = "default"): Promise<ScraperConfig> {
    const db = await this.getDb();
    const collection = db.collection<ScraperConfig>(SCRAPER_CONFIG_COLLECTION);

    const resetConfig: ScraperConfig = {
      ...DEFAULT_SCRAPER_CONFIG,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await collection.updateOne(
      { id },
      { $set: { ...resetConfig } },
      { upsert: true }
    );

    return resetConfig;
  }
}
