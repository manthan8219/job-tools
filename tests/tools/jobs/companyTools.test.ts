import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCompaniesTool, getCompanyDetailsTool } from "../../../src/tools/jobs/companyTools.js";
import { queryPostgres } from "../../../src/db/index.js";

vi.mock("../../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("Company MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockCompanyRow = {
    id: "c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    name: "GitLab",
    slug: "gitlab",
    websiteUrl: "https://about.gitlab.com",
    logoUrl: "https://about.gitlab.com/logo.png",
    description: "The DevSecOps Platform",
    industry: "Technology",
    sizeRange: "1000-5000",
    headquartersLocationId: null,
    atsType: "greenhouse",
    atsBoardToken: "gitlab",
    linkedinUrl: "https://www.linkedin.com/company/gitlab-com",
    linkedinId: "gitlab-com",
    isActive: true,
    activeJobsCount: "12",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("searchCompaniesTool should return matching companies with activeJobsCount", async () => {
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
      rows: [mockCompanyRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await (searchCompaniesTool.execute as any)({
      query: "GitLab",
      atsType: "greenhouse",
      linkedinId: "gitlab-com",
      limit: 10,
      offset: 0,
    });

    expect(result.success).toBe(true);
    expect(result.totalFound).toBe(1);
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe("GitLab");
    expect(result.companies[0].activeJobsCount).toBe(12);
    expect(result.companies[0].atsType).toBe("greenhouse");
    expect(result.companies[0].linkedinId).toBe("gitlab-com");
    expect(result.companies[0].linkedinUrl).toBe("https://www.linkedin.com/company/gitlab-com");
  });

  it("getCompanyDetailsTool should return full company details and active jobs by slug", async () => {
    // 1. Company lookup query by slug
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockCompanyRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // 2. Count query for jobs
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // 3. Data query for jobs
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        {
          id: "job-1",
          jobKey: "hash-1",
          externalId: "ext-1",
          source: "greenhouse",
          title: "Senior Backend Engineer",
          company: "GitLab",
          companySlug: "gitlab",
          rawLocation: "Remote, Germany",
          workArrangement: "remote",
          employmentType: "full-time",
          skills: ["Ruby", "Go", "PostgreSQL"],
          salaryMin: 120000,
          salaryMax: 150000,
          salaryCurrency: "EUR",
          applyUrl: "https://boards.greenhouse.io/gitlab/jobs/1",
          status: "active",
          postedAt: new Date(),
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await (getCompanyDetailsTool.execute as any)({
      idOrSlug: "gitlab",
    });

    expect(result.success).toBe(true);
    expect(result.company).not.toBeNull();
    expect(result.company.name).toBe("GitLab");
    expect(result.company.linkedinId).toBe("gitlab-com");
    expect(result.company.linkedinUrl).toBe("https://www.linkedin.com/company/gitlab-com");
    expect(result.activeJobs).toHaveLength(1);
    expect(result.activeJobs[0].title).toBe("Senior Backend Engineer");
    expect(result.activeJobs[0].company).toBe("GitLab");
  });

  it("getCompanyDetailsTool should handle company not found gracefully", async () => {
    vi.mocked(queryPostgres).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await (getCompanyDetailsTool.execute as any)({
      idOrSlug: "non-existent-co",
    });

    expect(result.success).toBe(false);
    expect(result.company).toBeNull();
    expect(result.activeJobs).toHaveLength(0);
    expect(result.error).toContain("non-existent-co");
  });
});
