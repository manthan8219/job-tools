import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkableJobScraperAdapter } from "../../src/scrapers/adapters/workableAdapter.js";

const TEST_COMPANY = { name: "Typeform", slug: "typeform" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-xyz",
    title: "Backend Engineer",
    shortcode: "ABC123",
    url: "https://apply.workable.com/typeform/j/ABC123/",
    department: "Engineering",
    location: { city: "Barcelona", country: "Spain", remote: false },
    employment_type: "Full-time",
    published: "2026-07-15T00:00:00Z",
    ...overrides,
  };
}

function mockOkFetch(results: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results }),
  });
}

function mockErrorFetch() {
  return vi.fn().mockResolvedValue({ ok: false, status: 503 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WorkableJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Identity
  it("reports correct identity: isConfigured / source / name", () => {
    const adapter = new WorkableJobScraperAdapter({ companies: [TEST_COMPANY] });
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("workable");
    expect(adapter.name).toBe("WorkableJobScraperAdapter");
  });

  // 2. Successful parse + title filtering
  it("returns only jobs that match the query and maps fields correctly", async () => {
    const jobs = [
      makeJob({
        id: "eng-001",
        title: "Senior Frontend Engineer",
        shortcode: "FE001",
        url: "https://apply.workable.com/typeform/j/FE001/",
        department: "Engineering",
        location: { city: "Remote", country: "", remote: true },
      }),
      makeJob({
        id: "hr-002",
        title: "People Operations Manager",
        shortcode: "HR002",
        url: "https://apply.workable.com/typeform/j/HR002/",
        department: "HR",
        location: { city: "London", country: "UK", remote: false },
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(jobs));

    const adapter = new WorkableJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("workable");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("workable-eng-001");
    expect(job.title).toBe("Senior Frontend Engineer");
    expect(job.company).toBe("Typeform");
    expect(job.source).toBe("workable");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.url).toBe("https://apply.workable.com/typeform/j/FE001/");
  });

  // 3. HTTP error is non-fatal — returns empty results
  it("returns empty jobs when the API responds with an HTTP error", async () => {
    vi.stubGlobal("fetch", mockErrorFetch());

    const adapter = new WorkableJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("workable");
    expect(result.jobs).toHaveLength(0);
  });
});
