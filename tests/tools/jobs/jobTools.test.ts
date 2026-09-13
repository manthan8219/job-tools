import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchJobsDatabaseTool, getJobDetailsTool } from "../../../src/tools/jobs/jobTools.js";
import { queryPostgres } from "../../../src/db/index.js";

vi.mock("../../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("Job MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockJobRow = {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    jobKey: "hash123",
    externalId: "ext-1",
    source: "ashby",
    title: "Software Engineer, Frontend",
    company: "Ramp",
    companySlug: "ramp",
    description: "<p>Build Next.js apps</p>",
    excerpt: "Frontend engineering role",
    applyUrl: "https://jobs.ashbyhq.com/ramp/123",
    applyType: "url",
    employmentType: "full-time",
    workArrangement: "remote",
    experienceLevel: "mid",
    categories: ["Engineering"],
    skills: ["React", "TypeScript", "Next.js"],
    salaryMin: 140000,
    salaryMax: 175000,
    salaryCurrency: "USD",
    salaryPeriod: "annual",
    primaryLocationId: "loc-us",
    rawLocation: "New York, NY",
    isWorldwide: false,
    status: "active",
    postedAt: new Date(),
    lastSeenAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    locationName: "New York City",
    locationPath: "world.north-america.us.new-york.nyc",
    countryCode: "US",
  };

  it("searchJobsDatabaseTool should search with location and skills filters", async () => {
    // 1. Count query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // 2. Data query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockJobRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await searchJobsDatabaseTool.execute({
      query: "Frontend",
      countryCode: "US",
      workArrangement: "remote",
      skills: ["React"],
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.totalFound).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Software Engineer, Frontend");
    expect(result.jobs[0].company).toBe("Ramp");
    expect(result.jobs[0].skills).toContain("React");
  });

  it("getJobDetailsTool should return job details when found", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockJobRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await getJobDetailsTool.execute({
      id: mockJobRow.id,
    });

    expect(result.success).toBe(true);
    expect(result.job?.company).toBe("Ramp");
    expect(result.job?.applyUrl).toBe("https://jobs.ashbyhq.com/ramp/123");
  });

  it("getJobDetailsTool should return failure message when job is not found", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await getJobDetailsTool.execute({
      id: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});
