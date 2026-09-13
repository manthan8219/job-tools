import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobService } from "../../src/jobs/services/jobService.js";
import { ScrapedJob } from "../../src/scrapers/types.js";

describe("JobService", () => {
  let jobRepoMock: any;
  let locationRepoMock: any;
  let service: JobService;

  beforeEach(() => {
    vi.clearAllMocks();

    jobRepoMock = {
      upsertJob: vi.fn().mockImplementation(async (input) => ({
        ...input,
        id: "mock-uuid",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findJobs: vi.fn(),
      findById: vi.fn(),
    };

    locationRepoMock = {
      findMatchingLocation: vi.fn().mockResolvedValue({
        id: "loc-de-uuid",
        type: "country",
        name: "Germany",
        code: "DE",
        path: "world.europe.de",
      }),
    };

    service = new JobService(jobRepoMock, locationRepoMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should generate deterministic job keys", () => {
    const key1 = service.generateJobKey("GitLab", "Senior Backend Engineer", "Remote, Germany");
    const key2 = service.generateJobKey("gitlab", "senior backend engineer", "remote, germany");
    const key3 = service.generateJobKey("GitLab", "Frontend Engineer", "Remote, Germany");

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toHaveLength(64); // SHA-256 hex
  });

  it("should accurately extract recognized tech skills", () => {
    const text = "We are seeking a developer proficient in TypeScript, React, and PostgreSQL on AWS and Docker.";
    const categories = ["Engineering", "Kubernetes"];

    const skills = service.extractSkills(text, categories);

    expect(skills).toContain("TypeScript");
    expect(skills).toContain("React");
    expect(skills).toContain("PostgreSQL");
    expect(skills).toContain("AWS");
    expect(skills).toContain("Docker");
    expect(skills).toContain("Kubernetes");
  });

  it("should infer experience level from title", () => {
    expect(service.inferExperienceLevel("Senior Software Engineer")).toBe("senior");
    expect(service.inferExperienceLevel("Staff Platform Architect")).toBe("lead");
    expect(service.inferExperienceLevel("Junior Frontend Developer")).toBe("entry");
    expect(service.inferExperienceLevel("Engineering Director")).toBe("executive");
    expect(service.inferExperienceLevel("Software Developer")).toBe("unknown");
  });

  it("should ingest scraped job and resolve hierarchical location", async () => {
    const scraped: ScrapedJob = {
      id: "greenhouse-12345",
      title: "Senior Full Stack Engineer",
      company: "Celonis",
      location: "Munich, Germany",
      description: "<p>Celonis is looking for a Senior Full Stack Engineer with TypeScript and Node.js</p>",
      excerpt: "Full stack engineering role",
      url: "https://example.com/jobs/12345",
      source: "greenhouse",
      employmentType: "full-time",
      workArrangement: "hybrid",
      categories: ["Engineering"],
      salaryMin: 90000,
      salaryMax: 120000,
      salaryCurrency: "EUR",
      salaryPeriod: "annual",
      scrapedAt: new Date(),
    };

    const ingested = await service.ingestScrapedJob(scraped);

    expect(locationRepoMock.findMatchingLocation).toHaveBeenCalledWith("Munich, Germany");
    expect(jobRepoMock.upsertJob).toHaveBeenCalledTimes(1);

    expect(ingested.company).toBe("Celonis");
    expect(ingested.title).toBe("Senior Full Stack Engineer");
    expect(ingested.experienceLevel).toBe("senior");
    expect(ingested.skills).toContain("TypeScript");
    expect(ingested.skills).toContain("Node.js");
    expect(ingested.primaryLocationId).toBe("loc-de-uuid");
  });
});
