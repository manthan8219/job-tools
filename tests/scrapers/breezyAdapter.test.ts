import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BreezyJobScraperAdapter } from "../../src/scrapers/adapters/breezyAdapter.js";

const TEST_COMPANY = { name: "Alchemy", slug: "alchemy" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Breezy returns a plain JSON array (not wrapped in an object)
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-abc",
    name: "Software Engineer",
    url: "https://alchemy.breezy.hr/p/job-abc-software-engineer",
    location: { name: "Remote", is_remote: true },
    department: "Engineering",
    type: { name: "Full-time" },
    published_date: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

function mockOkFetch(jobs: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => jobs,
  });
}

function mockErrorFetch() {
  return vi.fn().mockResolvedValue({ ok: false, status: 500 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BreezyJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Identity
  it("reports correct identity: isConfigured / source / name", () => {
    const adapter = new BreezyJobScraperAdapter({ companies: [TEST_COMPANY] });
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("breezy");
    expect(adapter.name).toBe("BreezyJobScraperAdapter");
  });

  // 2. Successful parse + title filtering
  it("returns only jobs that match the query and maps fields correctly", async () => {
    const jobUrl = "https://alchemy.breezy.hr/p/eng-001-senior-engineer";
    const jobs = [
      makeJob({
        id: "eng-001",
        name: "Senior Software Engineer",
        url: jobUrl,
        location: { name: "Remote", is_remote: true },
        department: "Engineering",
      }),
      makeJob({
        id: "mkt-002",
        name: "Brand Marketing Lead",
        url: "https://alchemy.breezy.hr/p/mkt-002-brand-marketing-lead",
        location: { name: "New York, NY", is_remote: false },
        department: "Marketing",
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(jobs));

    const adapter = new BreezyJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("breezy");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    // ID is breezy-${encodeURIComponent(item.url)}
    expect(job.id).toBe(`breezy-${encodeURIComponent(jobUrl)}`);
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("Alchemy");
    expect(job.source).toBe("breezy");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.url).toBe(jobUrl);
  });

  // 3. HTTP error is non-fatal — returns empty results
  it("returns empty jobs when the API responds with an HTTP error", async () => {
    vi.stubGlobal("fetch", mockErrorFetch());

    const adapter = new BreezyJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("breezy");
    expect(result.jobs).toHaveLength(0);
  });
});
