import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScraperConfigRepository } from "../../src/scrapers/config/scraperConfigRepository.js";
import { ScraperConfigService } from "../../src/scrapers/config/scraperConfigService.js";
import { DEFAULT_SCRAPER_CONFIG } from "../../src/scrapers/config/scraperConfigModel.js";
import { getScraperConfigTool } from "../../src/tools/scrapers/scraperConfigTools.js";
import { getMongoDb } from "../../src/db/index.js";

vi.mock("../../src/db/index.js", () => ({
  getMongoDb: vi.fn(),
}));

describe("Scraper MongoDB Configuration System", () => {
  let mockCollection: any;
  let mockDb: any;
  let repository: ScraperConfigRepository;
  let service: ScraperConfigService;

  beforeEach(() => {
    vi.clearAllMocks();

    let storedDoc: any = null;

    mockCollection = {
      findOne: vi.fn().mockImplementation(async () => (storedDoc ? JSON.parse(JSON.stringify(storedDoc)) : null)),
      insertOne: vi.fn().mockImplementation(async (doc: any) => {
        storedDoc = { ...doc };
        return { acknowledged: true };
      }),
      updateOne: vi.fn().mockImplementation(async (_query: any, update: any) => {
        storedDoc = { ...storedDoc, ...update.$set };
        return { acknowledged: true };
      }),
    };

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    vi.mocked(getMongoDb).mockResolvedValue(mockDb as any);

    repository = new ScraperConfigRepository(mockDb as any);
    service = new ScraperConfigService(repository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Repository Auto-Seeding and Retrieval", () => {
    it("should automatically seed DEFAULT_SCRAPER_CONFIG into MongoDB if no config exists", async () => {
      const config = await repository.getConfig("default");

      expect(mockCollection.findOne).toHaveBeenCalledWith({ id: "default" }, { projection: { _id: 0 } });
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(config.id).toBe("default");
      expect(config.version).toBe(1);
      expect(config.supportedTitles.length).toBeGreaterThanOrEqual(8);
      expect(config.supportedCountries.length).toBeGreaterThanOrEqual(8);
      expect(config.supportedSources.length).toBe(8);
    });

    it("should retrieve existing config without re-seeding", async () => {
      // Seed first
      await repository.getConfig("default");
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);

      // Fetch second time
      const config = await repository.getConfig("default");
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1); // not called again
      expect(config.supportedTitles[0].title).toBe("Software Engineer");
    });
  });

  describe("Dynamic Title and Country Registration", () => {
    it("should dynamically add a new supported job title into MongoDB", async () => {
      await repository.getConfig("default");

      const updated = await repository.addSupportedTitle({
        title: "Cybersecurity Analyst",
        slug: "cybersecurity-analyst",
        category: "Security",
        aliases: ["infosec analyst", "security engineer"],
        enabled: true,
      });

      expect(mockCollection.updateOne).toHaveBeenCalled();
      const added = updated.supportedTitles.find((t) => t.slug === "cybersecurity-analyst");
      expect(added).toBeDefined();
      expect(added?.title).toBe("Cybersecurity Analyst");
      expect(added?.aliases).toContain("infosec analyst");
    });

    it("should dynamically add a new supported country into MongoDB", async () => {
      await repository.getConfig("default");

      const updated = await repository.addSupportedCountry({
        code: "JP",
        name: "Japan",
        aliases: ["japan", "tokyo", "osaka"],
        enabled: true,
      });

      expect(mockCollection.updateOne).toHaveBeenCalled();
      const added = updated.supportedCountries.find((c) => c.code === "JP");
      expect(added).toBeDefined();
      expect(added?.name).toBe("Japan");
    });

    it("should toggle active status for scraper sources", async () => {
      await repository.getConfig("default");

      const updated = await repository.toggleSource("greenhouse", false);
      const gh = updated.supportedSources.find((s) => s.source === "greenhouse");
      expect(gh?.enabled).toBe(false);

      const reEnabled = await repository.toggleSource("greenhouse", true);
      const ghRe = reEnabled.supportedSources.find((s) => s.source === "greenhouse");
      expect(ghRe?.enabled).toBe(true);
    });
  });

  describe("Service Title and Country Matching", () => {
    it("should recognize supported titles by name or alias", async () => {
      expect(await service.isTitleSupported("Software Engineer")).toBe(true);
      expect(await service.isTitleSupported("Software Developer")).toBe(true);
      expect(await service.isTitleSupported("SWE")).toBe(true);
      expect(await service.isTitleSupported("React Developer")).toBe(true);
      expect(await service.isTitleSupported("Astronaut")).toBe(false);
    });

    it("should recognize supported countries by name, code, or alias", async () => {
      expect(await service.isCountrySupported("Germany")).toBe(true);
      expect(await service.isCountrySupported("DE")).toBe(true);
      expect(await service.isCountrySupported("Berlin")).toBe(true);
      expect(await service.isCountrySupported("Canada")).toBe(true);
      expect(await service.isCountrySupported("CA")).toBe(true);
      expect(await service.isCountrySupported("USA")).toBe(true);
      expect(await service.isCountrySupported("Atlantis")).toBe(false);
    });

    it("should return correct matching objects", async () => {
      const titleMatch = await service.findMatchingTitle("full stack developer");
      expect(titleMatch).not.toBeNull();
      expect(titleMatch?.title).toBe("Full Stack Engineer");

      const countryMatch = await service.findMatchingCountry("munich");
      expect(countryMatch).not.toBeNull();
      expect(countryMatch?.code).toBe("DE");
    });
  });

  describe("Mastra MCP Tools for Configuration", () => {
    it("getScraperConfigTool should execute and return enabled titles, countries, and sources", async () => {
      const result = await getScraperConfigTool.execute({ onlyEnabled: true });

      expect(result.success).toBe(true);
      expect(result.config.supportedTitles.length).toBeGreaterThan(0);
      expect(result.config.supportedCountries.some((c) => c.code === "DE")).toBe(true);
      expect(result.config.supportedCountries.some((c) => c.code === "CA")).toBe(true);
      expect(result.config.supportedCountries.some((c) => c.code === "US")).toBe(true);
    });
  });
});

