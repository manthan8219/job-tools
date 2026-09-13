import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WorkdayJobScraperAdapter,
  parseWorkdayPostedDate,
  parseWorkdayUrl,
} from "../../src/scrapers/adapters/workdayAdapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SALESFORCE_COMPANY = {
  name: "Salesforce",
  url: "https://salesforce.wd1.myworkdayjobs.com/en-US/External_Career_Site",
};

// Two postings returned by the mocked Workday CXS API
const ENGINEER_POSTING = {
  title: "Senior Software Engineer",
  externalPath: "/job/senior-software-engineer-12345",
  locationsText: "Remote, USA",
  postedOn: "Posted Today",
  timeType: "Full Time",
};

const SALES_POSTING = {
  title: "Sales Representative",
  externalPath: "/job/sales-rep-67890",
  locationsText: "San Francisco, CA",
  postedOn: "Posted 2 Days Ago",
  timeType: "Full Time",
};

function makeApiResponse(jobPostings: object[]) {
  return { total: jobPostings.length, jobPostings };
}

function makeMockFetch(status: number, body: object) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WorkdayJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Adapter identity
  // -------------------------------------------------------------------------
  describe("adapter identity", () => {
    it("reports correct name, source, and isConfigured", () => {
      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      expect(adapter.name).toBe("WorkdayJobScraperAdapter");
      expect(adapter.source).toBe("workday");
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. POST to Workday CXS URL; field mapping; title filter; remote detection
  // -------------------------------------------------------------------------
  describe("scrape – happy path", () => {
    it("sends a POST to the correct Workday CXS URL", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([ENGINEER_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      await adapter.scrape({ query: "Engineer" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];

      // CXS endpoint pattern: /wday/cxs/<tenant>/<site>/jobs
      expect(url).toBe(
        "https://salesforce.wd1.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs",
      );
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({ searchText: "Engineer" });
    });

    it("query='Engineer' returns only the Senior Software Engineer posting", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([ENGINEER_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      const result = await adapter.scrape({ query: "Engineer" });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Senior Software Engineer");
    });

    it("maps fields correctly including workArrangement='remote' for 'Remote, USA'", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([ENGINEER_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      const result = await adapter.scrape({ query: "Engineer" });

      const job = result.jobs[0];

      // ID starts with 'workday-'
      expect(job.id).toMatch(/^workday-/);
      expect(job.source).toBe("workday");
      expect(job.company).toBe("Salesforce");
      expect(job.workArrangement).toBe("remote"); // locationsText includes "Remote"
      expect(job.employmentType).toBe("full-time"); // timeType="Full Time"
      expect(job.location).toBe("Remote, USA");

      // URL must be a valid https link
      expect(job.url).toMatch(/^https:\/\/salesforce\.wd1\.myworkdayjobs\.com/);

      // postedAt derived from "Posted Today"
      expect(job.postedAt).toBeInstanceOf(Date);
    });

    it("id is `workday-${encodeURIComponent(applyUrl)}`", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([ENGINEER_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      const result = await adapter.scrape({ query: "Engineer" });

      const job = result.jobs[0];
      const expectedApplyUrl =
        "https://salesforce.wd1.myworkdayjobs.com/External_Career_Site/job/senior-software-engineer-12345";
      expect(job.id).toBe(`workday-${encodeURIComponent(expectedApplyUrl)}`);
    });

    it("returns no jobs when query does not match any posting", async () => {
      const mockFetch = makeMockFetch(200, makeApiResponse([ENGINEER_POSTING, SALES_POSTING]));
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      const result = await adapter.scrape({ query: "DataScientist_NOMATCH_XYZ" });

      expect(result.jobs).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. HTTP error for a company is non-fatal; other companies still run
  // -------------------------------------------------------------------------
  describe("scrape – company HTTP error is non-fatal", () => {
    it("returns empty jobs when the single company returns HTTP 500", async () => {
      const mockFetch = makeMockFetch(500, {});
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({ companies: [SALESFORCE_COMPANY] });
      // Should NOT throw; just returns empty
      const result = await adapter.scrape({ query: "Engineer" });

      expect(result.jobs).toHaveLength(0);
      expect(result.source).toBe("workday");
      // No top-level error because the company failure is swallowed internally
    });

    it("still processes a second company even if the first fails", async () => {
      const SECOND_COMPANY = {
        name: "Oracle",
        url: "https://oracle.wd5.myworkdayjobs.com/en-US/External",
      };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First company (Salesforce) fails
          return { ok: false, status: 500, json: async () => ({}) };
        }
        // Second company (Oracle) succeeds
        return {
          ok: true,
          status: 200,
          json: async () => makeApiResponse([ENGINEER_POSTING]),
        };
      });
      vi.stubGlobal("fetch", mockFetch);

      const adapter = new WorkdayJobScraperAdapter({
        companies: [SALESFORCE_COMPANY, SECOND_COMPANY],
        concurrency: 1, // sequential so order is deterministic
      });
      const result = await adapter.scrape({ query: "Engineer" });

      // Oracle's posting should survive
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Senior Software Engineer");
    });
  });
});

// ---------------------------------------------------------------------------
// 4. parseWorkdayPostedDate utility
// ---------------------------------------------------------------------------

describe("parseWorkdayPostedDate", () => {
  it("returns a Date for 'Posted Today'", () => {
    const result = parseWorkdayPostedDate("Posted Today");
    expect(result).toBeInstanceOf(Date);
    // Should be within a few seconds of now
    expect(Math.abs(Date.now() - result!.getTime())).toBeLessThan(5000);
  });

  it("returns a Date approximately 1 day ago for 'Posted Yesterday'", () => {
    const result = parseWorkdayPostedDate("Posted Yesterday");
    expect(result).toBeInstanceOf(Date);
    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.now() - result!.getTime() - oneDayMs)).toBeLessThan(5000);
  });

  it("returns a Date approximately 3 days ago for 'Posted 3 Days Ago'", () => {
    const result = parseWorkdayPostedDate("Posted 3 Days Ago");
    expect(result).toBeInstanceOf(Date);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.now() - result!.getTime() - threeDaysMs)).toBeLessThan(5000);
  });

  it("returns undefined for undefined input", () => {
    expect(parseWorkdayPostedDate(undefined)).toBeUndefined();
  });

  it("returns undefined for an unrecognised string", () => {
    expect(parseWorkdayPostedDate("2 weeks ago")).toBeUndefined();
  });

  it("returns undefined for a date string 30+ days ago (guard against stale)', () => {", () => {
    // '30 days ago' → days < 30 is false at exactly 30, so should return undefined
    expect(parseWorkdayPostedDate("Posted 30 Days Ago")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. parseWorkdayUrl utility
// ---------------------------------------------------------------------------

describe("parseWorkdayUrl", () => {
  it("parses a valid Workday URL with locale prefix", () => {
    const result = parseWorkdayUrl(
      "https://salesforce.wd1.myworkdayjobs.com/en-US/External_Career_Site",
    );
    expect(result).not.toBeNull();
    expect(result!.tenant).toBe("salesforce");
    expect(result!.instance).toBe("wd1");
    expect(result!.site).toBe("External_Career_Site");
  });

  it("parses a valid Workday URL without locale prefix", () => {
    const result = parseWorkdayUrl(
      "https://oracle.wd5.myworkdayjobs.com/External",
    );
    expect(result).not.toBeNull();
    expect(result!.tenant).toBe("oracle");
    expect(result!.instance).toBe("wd5");
    expect(result!.site).toBe("External");
  });

  it("returns null for a non-Workday URL", () => {
    expect(parseWorkdayUrl("https://careers.google.com/jobs")).toBeNull();
  });

  it("returns null for a completely invalid URL string", () => {
    expect(parseWorkdayUrl("not-a-url")).toBeNull();
  });

  it("returns null when hostname has fewer than 4 parts", () => {
    // e.g. 'foo.myworkdayjobs.com' has only 3 parts
    expect(parseWorkdayUrl("https://foo.myworkdayjobs.com/site")).toBeNull();
  });

  it("returns null when pathname is empty (no site segment)", () => {
    expect(parseWorkdayUrl("https://tenant.wd1.myworkdayjobs.com/")).toBeNull();
  });
});
