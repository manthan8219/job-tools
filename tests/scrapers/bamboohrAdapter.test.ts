import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BambooHRJobScraperAdapter } from "../../src/scrapers/adapters/bamboohrAdapter.js";

const TEST_COMPANY = { name: "Gusto", slug: "gusto" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "100",
    jobOpeningName: "Software Engineer",
    location: { city: "San Francisco", state: "CA" },
    departmentLabel: "Engineering",
    employmentType: "Full-time",
    isRemote: false,
    ...overrides,
  };
}

function mockOkFetch(result: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result }),
  });
}

function mockErrorFetch() {
  return vi.fn().mockResolvedValue({ ok: false, status: 404 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BambooHRJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Identity
  it("reports correct identity: isConfigured / source / name", () => {
    const adapter = new BambooHRJobScraperAdapter({ companies: [TEST_COMPANY] });
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("bamboohr");
    expect(adapter.name).toBe("BambooHRJobScraperAdapter");
  });

  // 2. Successful parse + title filtering
  it("returns only jobs that match the query, maps id/company/workArrangement/categories correctly", async () => {
    const items = [
      makeItem({
        id: "101",
        jobOpeningName: "Senior Backend Engineer",
        isRemote: true,
        location: { city: undefined, state: undefined },
        departmentLabel: "Engineering",
      }),
      makeItem({
        id: "102",
        jobOpeningName: "Sales Manager",
        isRemote: false,
        location: { city: "Denver", state: "CO" },
        departmentLabel: "Sales",
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(items));

    const adapter = new BambooHRJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Backend" });

    expect(result.source).toBe("bamboohr");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("bamboohr-gusto-101");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Gusto");
    expect(job.source).toBe("bamboohr");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.url).toBe("https://gusto.bamboohr.com/careers/101");
  });

  // 3. Location built from city + state; isRemote=false -> on-site
  it("builds locationStr from city+state and sets workArrangement=on-site when not remote", async () => {
    const items = [
      makeItem({
        id: "200",
        jobOpeningName: "DevOps Engineer",
        isRemote: false,
        location: { city: "Austin", state: "TX" },
        departmentLabel: "Infrastructure",
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(items));

    const adapter = new BambooHRJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "DevOps" });

    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.location).toBe("Austin, TX");
    expect(job.workArrangement).toBe("on-site");
  });

  // 4. HTTP error is non-fatal — returns empty results
  it("returns empty jobs when the API responds with an HTTP error", async () => {
    vi.stubGlobal("fetch", mockErrorFetch());

    const adapter = new BambooHRJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("bamboohr");
    expect(result.jobs).toHaveLength(0);
  });
});
