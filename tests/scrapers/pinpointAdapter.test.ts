import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PinpointJobScraperAdapter } from "../../src/scrapers/adapters/pinpointAdapter.js";

const TEST_COMPANY = { name: "Loom", slug: "loom" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Software Engineer",
    url: "https://loom.pinpointhq.com/postings/1",
    path: "/postings/1",
    location: { name: "San Francisco, CA" },
    department: { name: "Engineering" },
    employment_type: "Full-time",
    workplace_type: "on_site",
    ...overrides,
  };
}

function mockOkFetch(data: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  });
}

function mockErrorFetch() {
  return vi.fn().mockResolvedValue({ ok: false, status: 502 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PinpointJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Identity
  it("reports correct identity: isConfigured / source / name", () => {
    const adapter = new PinpointJobScraperAdapter({ companies: [TEST_COMPANY] });
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("pinpoint");
    expect(adapter.name).toBe("PinpointJobScraperAdapter");
  });

  // 2. Successful parse + title filtering
  it("returns only jobs that match the query and maps fields correctly", async () => {
    const jobs = [
      makeJob({
        id: 101,
        title: "Senior Platform Engineer",
        url: "https://loom.pinpointhq.com/postings/101",
        location: { name: "Remote" },
        department: { name: "Engineering" },
        workplace_type: "remote",
      }),
      makeJob({
        id: 202,
        title: "Finance Analyst",
        url: "https://loom.pinpointhq.com/postings/202",
        location: { name: "San Francisco, CA" },
        department: { name: "Finance" },
        workplace_type: "on_site",
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(jobs));

    const adapter = new PinpointJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("pinpoint");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    // ID: pinpoint-${company.slug}-${item.id}
    expect(job.id).toBe("pinpoint-loom-101");
    expect(job.title).toBe("Senior Platform Engineer");
    expect(job.company).toBe("Loom");
    expect(job.source).toBe("pinpoint");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.url).toBe("https://loom.pinpointhq.com/postings/101");
  });

  // 3. HTTP error is non-fatal — returns empty results
  it("returns empty jobs when the API responds with an HTTP error", async () => {
    vi.stubGlobal("fetch", mockErrorFetch());

    const adapter = new PinpointJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("pinpoint");
    expect(result.jobs).toHaveLength(0);
  });
});
