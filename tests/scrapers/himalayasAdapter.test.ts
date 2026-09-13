import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HimalayasJobScraperAdapter } from "../../src/scrapers/adapters/himalayasAdapter.js";

describe("HimalayasJobScraperAdapter", () => {
  let adapter: HimalayasJobScraperAdapter;

  beforeEach(() => {
    adapter = new HimalayasJobScraperAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true since it requires no authentication", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("himalayas");
    expect(adapter.name).toBe("HimalayasJobScraperAdapter");
  });

  it("should successfully fetch and map search results", async () => {
    const mockApiResponse = {
      updatedAt: 1740300000000,
      offset: 0,
      limit: 20,
      totalCount: 1,
      jobs: [
        {
          title: "Senior Backend Engineer",
          excerpt: "Looking for a backend engineer...",
          companyName: "Acme Corp",
          companySlug: "acme-corp",
          companyLogo: "https://example.com/logo.png",
          employmentType: "Full Time",
          minSalary: 140000,
          maxSalary: 180000,
          salaryPeriod: "annual",
          currency: "USD",
          seniority: ["Senior"],
          locationRestrictions: [
            { alpha2: "US", name: "United States", slug: "united-states" }
          ],
          timezoneRestrictions: ["UTC-5"],
          categories: ["Node.js", "TypeScript", "PostgreSQL"],
          parentCategories: ["Engineering"],
          description: "<p>Job description here</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/apply",
          guid: "acme-senior-backend-123",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "Node.js",
      country: "US",
      limit: 20,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/jobs/api/search");
    expect(calledUrl).toContain("q=Node.js");
    expect(calledUrl).toContain("country=US");

    expect(result.source).toBe("himalayas");
    expect(result.totalFound).toBe(1);
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("acme-senior-backend-123");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Acme Corp");
    expect(job.location).toBe("United States");
    expect(job.workArrangement).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.salaryMin).toBe(140000);
    expect(job.salaryMax).toBe(180000);
    expect(job.salaryPeriod).toBe("annual");
    expect(job.categories).toEqual(["Node.js", "TypeScript", "PostgreSQL"]);
    expect(job.description).toBe("<p>Job description here</p>");
    expect(job.excerpt).toBe("Looking for a backend engineer...");
  });

  it("should map empty locationRestrictions to Worldwide (Remote)", async () => {
    const mockApiResponse = {
      updatedAt: 1740300000000,
      offset: 0,
      limit: 20,
      totalCount: 1,
      jobs: [
        {
          title: "Staff DevOps Engineer",
          excerpt: "Devops description",
          companyName: "Global Tech",
          companySlug: "global-tech",
          companyLogo: "https://example.com/logo.png",
          employmentType: "Contractor",
          minSalary: null,
          maxSalary: null,
          salaryPeriod: "annual",
          currency: "USD",
          seniority: ["Senior"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["Kubernetes", "AWS"],
          parentCategories: ["Engineering"],
          description: "<p>Devops description</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/apply-devops",
          guid: "global-devops-456",
        },
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    }));

    const result = await adapter.scrape({});
    expect(result.jobs[0].location).toBe("Worldwide (Remote)");
    expect(result.jobs[0].employmentType).toBe("contract");
    expect(result.jobs[0].workArrangement).toBe("remote");
  });

  it("should handle multi-page cursor pagination in browse mode", async () => {
    const mockPage1 = {
      updatedAt: 1740300000000,
      offset: 0,
      limit: 1,
      totalCount: 2,
      nextCursor: "cursor-page-2",
      jobs: [
        {
          title: "Frontend Engineer",
          excerpt: "Excerpt 1",
          companyName: "Company A",
          companySlug: "company-a",
          companyLogo: "https://example.com/logo1.png",
          employmentType: "Full Time",
          currency: "USD",
          salaryPeriod: "annual",
          seniority: ["Mid-level"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["React"],
          parentCategories: ["Engineering"],
          description: "<p>Job 1</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/job1",
          guid: "guid-1",
        },
      ],
    };

    const mockPage2 = {
      updatedAt: 1740300000000,
      offset: 1,
      limit: 1,
      totalCount: 2,
      // No nextCursor means last page
      jobs: [
        {
          title: "Backend Engineer",
          excerpt: "Excerpt 2",
          companyName: "Company B",
          companySlug: "company-b",
          companyLogo: "https://example.com/logo2.png",
          employmentType: "Full Time",
          currency: "USD",
          salaryPeriod: "annual",
          seniority: ["Senior"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["Node.js"],
          parentCategories: ["Engineering"],
          description: "<p>Job 2</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/job2",
          guid: "guid-2",
        },
      ],
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPage1,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPage2,
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      limit: 1,
      maxPages: 2,
      delayMs: 0,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // First request without cursor
    expect(mockFetch.mock.calls[0][0]).toContain("/jobs/api?limit=1");
    // Second request with cursor passed from page 1
    expect(mockFetch.mock.calls[1][0]).toContain("cursor=cursor-page-2");

    // Both jobs collected
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].id).toBe("guid-1");
    expect(result.jobs[1].id).toBe("guid-2");
    expect(result.pagesFetched).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("should handle search page pagination across multiple pages", async () => {
    const mockSearchPage1 = {
      updatedAt: 1740300000000,
      offset: 0,
      limit: 1,
      totalCount: 2,
      jobs: [
        {
          title: "Search Job 1",
          excerpt: "Excerpt 1",
          companyName: "Search Co 1",
          companySlug: "search-co-1",
          companyLogo: "https://example.com/logo1.png",
          employmentType: "Full Time",
          currency: "USD",
          salaryPeriod: "annual",
          seniority: ["Senior"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["Python"],
          parentCategories: ["Engineering"],
          description: "<p>Search Job 1</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/job1",
          guid: "sguid-1",
        },
      ],
    };

    const mockSearchPage2 = {
      updatedAt: 1740300000000,
      offset: 1,
      limit: 1,
      totalCount: 2,
      jobs: [
        {
          title: "Search Job 2",
          excerpt: "Excerpt 2",
          companyName: "Search Co 2",
          companySlug: "search-co-2",
          companyLogo: "https://example.com/logo2.png",
          employmentType: "Full Time",
          currency: "USD",
          salaryPeriod: "annual",
          seniority: ["Senior"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["Go"],
          parentCategories: ["Engineering"],
          description: "<p>Search Job 2</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/job2",
          guid: "sguid-2",
        },
      ],
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchPage1,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchPage2,
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({
      query: "Engineer",
      maxPages: 2,
      limit: 1,
      delayMs: 0,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("/jobs/api/search?q=Engineer");
    expect(mockFetch.mock.calls[1][0]).toContain("page=2");

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].title).toBe("Search Job 1");
    expect(result.jobs[1].title).toBe("Search Job 2");
  });

  it("should stream pages using paginate async generator", async () => {
    const mockPage = {
      updatedAt: 1740300000000,
      offset: 0,
      limit: 1,
      totalCount: 1,
      jobs: [
        {
          title: "Streamed Job",
          excerpt: "Excerpt",
          companyName: "Stream Co",
          companySlug: "stream-co",
          companyLogo: "https://example.com/logo.png",
          employmentType: "Full Time",
          currency: "USD",
          salaryPeriod: "annual",
          seniority: ["Mid-level"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: ["TypeScript"],
          parentCategories: ["Engineering"],
          description: "<p>Stream</p>",
          pubDate: 1740200000000,
          expiryDate: 1742800000000,
          applicationLink: "https://example.com/stream",
          guid: "stream-guid",
        },
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPage,
    }));

    const pages = [];
    for await (const page of adapter.paginate({ limit: 1 })) {
      pages.push(page);
      break;
    }

    expect(pages).toHaveLength(1);
    expect(pages[0].jobs[0].id).toBe("stream-guid");
  });

  it("should handle 429 rate limits gracefully without throwing unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Too many requests. Please try again in a few seconds.",
    }));

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toContain("Rate limit exceeded");
  });
});
