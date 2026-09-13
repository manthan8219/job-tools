import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ScraperConfigService } from "../../scrapers/config/scraperConfigService.js";
import {
  SupportedTitleSchema,
  SupportedCountrySchema,
} from "../../scrapers/config/scraperConfigModel.js";

const configService = new ScraperConfigService();

/**
 * MCP Tool to retrieve supported roles, countries, and scrapers from MongoDB
 */
export const getScraperConfigTool = createTool({
  id: "get-scraper-config",
  description:
    "Retrieve the current job scraper configuration from MongoDB, including all supported titles, supported countries, and active sources.",
  inputSchema: z.object({
    onlyEnabled: z.boolean().default(true).describe("Filter only currently enabled titles, countries, and sources"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    config: z.object({
      id: z.string(),
      version: z.number(),
      description: z.string().optional(),
      supportedTitles: z.array(SupportedTitleSchema),
      supportedCountries: z.array(SupportedCountrySchema),
      supportedSources: z.array(
        z.object({
          source: z.string(),
          name: z.string(),
          enabled: z.boolean(),
        })
      ),
      settings: z.record(z.unknown()),
      updatedAt: z.date(),
    }),
  }),
  execute: async (input) => {
    const onlyEnabled = input?.onlyEnabled ?? true;
    const rawConfig = await configService.getConfig();

    return {
      success: true,
      config: {
        id: rawConfig.id,
        version: rawConfig.version,
        description: rawConfig.description,
        supportedTitles: onlyEnabled
          ? rawConfig.supportedTitles.filter((t) => t.enabled)
          : rawConfig.supportedTitles,
        supportedCountries: onlyEnabled
          ? rawConfig.supportedCountries.filter((c) => c.enabled)
          : rawConfig.supportedCountries,
        supportedSources: onlyEnabled
          ? rawConfig.supportedSources.filter((s) => s.enabled)
          : rawConfig.supportedSources,
        settings: rawConfig.settings,
        updatedAt: rawConfig.updatedAt,
      },
    };
  },
});

