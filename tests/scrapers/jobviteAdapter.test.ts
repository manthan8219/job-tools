import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobviteJobScraperAdapter } from "../../src/scrapers/adapters/jobviteAdapter.js";

describe("JobviteJobScraperAdapter", () => {
  let adapter: JobviteJobScraperAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new JobviteJobScraperAdapter({
      companies: [{ name: "Twilio", slug: "twilio" }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured, source, and name correctly", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("jobvite");
    expect(adapter.name).toBe("JobviteJobScraperAdapter");
  });

  it("should fetch jobs and return only those matching the query", async () => {
    const mockApiResponse = {
      jobs: [
        {
          id: "jv-eng-001",
          title: "Staff Software Engineer",
          location: "San Francisco, CA",
          applyURL: "https://jobs.jobvite.com/twilio/job/jv-eng-001",
          category: "Engineering",
          date: "2026-09-05T08:00:00Z",
        },
        {
          id: "jv-sales-002",
          title: "Account Executive",
          location: "New York, NY",
          applyURL: "https://jobs.jobvite.com/twilio/job/jv-sales-002",
          category: "Sales",
          date: "2026-09-06T08:00:00Z",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.scrape({ query: "Engineer", limit: 10 });

    expect(result.source).toBe("jobvite");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("jobvite-jv-eng-001");
    expect(job.title).toBe("Staff Software Engineer");
    expect(job.company).toBe("Twilio");
    expect(job.source).toBe("jobvite");
    expect(job.url).toBe("https://jobs.jobvite.com/twilio/job/jv-eng-001");
    expect(job.categories).toContain("Engineering");
    expect(job.workArrangement).toBe("on-site");
    expect(job.employmentType).toBe("full-time");

    // Verify fetch was called with the correct Jobvite URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://jobs.jobvite.com/api/company/twilio/jobs",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should return empty jobs array when the company endpoint returns an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      })
    );

    const result = await adapter.scrape({ query: "Engineer" });
    expect(result.jobs).toHaveLength(0);
    expect(result.source).toBe("jobvite");
  });
});
