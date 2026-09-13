import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HackerNewsHiringAdapter } from "../../src/scrapers/adapters/hackerNewsAdapter.js";

describe("HackerNewsHiringAdapter", () => {
  let adapter: HackerNewsHiringAdapter;

  beforeEach(() => {
    adapter = new HackerNewsHiringAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should report isConfigured as true", () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.source).toBe("hackernews");
    expect(adapter.name).toBe("HackerNewsHiringAdapter");
  });

  it("should successfully fetch and parse HN hiring comments", async () => {
    const mockUser = {
      submitted: [10001],
    };
    const mockThread = {
      id: 10001,
      title: "Ask HN: Who is hiring? (September 2026)",
      kids: [20001, 20002],
    };
    const mockComment1 = {
      id: 20001,
      by: "founder1",
      time: 1740200000,
      text: "Acme AI | Senior Backend Engineer | San Francisco, CA | REMOTE | $150k - $200k | <a href=\"https://acme.ai\">https://acme.ai</a><p>We are building AI agents.</p>",
    };
    const mockComment2 = {
      id: 20002,
      by: "recruiter1",
      time: 1740200000,
      text: "Sales Corp | Account Executive | New York | ONSITE | <a href=\"https://sales.com\">https://sales.com</a>",
    };

    const mockFetch = vi.fn((url: string) => {
      if (url.includes("/user/whoishiring.json")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockUser });
      }
      if (url.includes("/item/10001.json")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockThread });
      }
      if (url.includes("/item/20001.json")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockComment1 });
      }
      if (url.includes("/item/20002.json")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockComment2 });
      }
      return Promise.reject(new Error("Unknown url"));
    });

    vi.stubGlobal("fetch", mockFetch as any);

    const result = await adapter.scrape({
      query: "Backend",
      limit: 10,
    });

    expect(result.source).toBe("hackernews");
    expect(result.jobs).toHaveLength(1);
    const job = result.jobs[0];
    expect(job.id).toBe("hn-20001");
    expect(job.company).toBe("Acme AI");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.location).toContain("San Francisco");
    expect(job.workArrangement).toBe("remote");
    expect(job.url).toBe("https://acme.ai");
    expect(job.description).toContain("We are building AI agents.");
  });
});
