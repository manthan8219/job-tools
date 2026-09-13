import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SmartRecruitersJobScraperAdapter } from "../../src/scrapers/adapters/smartrecruitersAdapter.js";

const TEST_COMPANY = { name: "Datadog", identifier: "Datadog" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosting(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc-123",
    name: "Software Engineer",
    releasedDate: "2026-08-01T00:00:00Z",
    location: { city: "New York", remote: false, fullLocation: "New York, NY" },
    department: { label: "Engineering" },
    typeOfEmployment: { label: "Full-time" },
    ...overrides,
  };
}

function mockOkFetch(content: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content }),
  });
}

function mockErrorFetch() {
  return vi.fn().mockResolvedValue({ ok: false, status: 500 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SmartRecruitersJobScraperAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Identity
  it("reports correct identity: isConfigured / source / name", () => {
    const adapter = new SmartRecruitersJobScraperAdapter({ companies: [TEST_COMPANY] });
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("smartrecruiters");
    expect(adapter.name).toBe("SmartRecruitersJobScraperAdapter");
  });

  // 2. Successful parse + title filtering
  it("returns only jobs that match the query and maps fields correctly", async () => {
    const postings = [
      makePosting({
        id: "eng-001",
        name: "Senior Software Engineer",
        location: { remote: true, fullLocation: "Remote" },
        department: { label: "Engineering" },
        typeOfEmployment: { label: "Full-time" },
      }),
      makePosting({
        id: "mkt-002",
        name: "Marketing Manager",
        location: { city: "Austin", remote: false, fullLocation: "Austin, TX" },
        department: { label: "Marketing" },
        typeOfEmployment: { label: "Full-time" },
      }),
    ];

    vi.stubGlobal("fetch", mockOkFetch(postings));

    const adapter = new SmartRecruitersJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("smartrecruiters");
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.id).toBe("smartrecruiters-eng-001");
    expect(job.title).toBe("Senior Software Engineer");
    expect(job.company).toBe("Datadog");
    expect(job.source).toBe("smartrecruiters");
    expect(job.workArrangement).toBe("remote");
    expect(job.categories).toEqual(["Engineering"]);
    expect(job.url).toBe("https://jobs.smartrecruiters.com/Datadog/eng-001");
  });

  // 3. HTTP error is non-fatal — returns empty results
  it("returns empty jobs when the API responds with an HTTP error", async () => {
    vi.stubGlobal("fetch", mockErrorFetch());

    const adapter = new SmartRecruitersJobScraperAdapter({ companies: [TEST_COMPANY] });
    const result = await adapter.scrape({ query: "Engineer" });

    expect(result.source).toBe("smartrecruiters");
    expect(result.jobs).toHaveLength(0);
  });
});
