import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AshbyJobApplierAdapter } from "../../src/appliers/adapters/ashbyApplier.js";

describe("AshbyJobApplierAdapter", () => {
  let adapter: AshbyJobApplierAdapter;

  beforeEach(() => {
    adapter = new AshbyJobApplierAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports correct identity and matcher", () => {
    expect(adapter.name).toBe("AshbyJobApplierAdapter");
    expect(adapter.provider).toBe("ashby");
    expect(adapter.matches("https://jobs.ashbyhq.com/ramp/uuid-1234")).toBe(true);
    expect(adapter.matches("https://example.com/uuid-1234")).toBe(false);
  });

  it("fetches org API key and submits application form", async () => {
    const mockBoardHtml = '<html><script>window.__NEXT_DATA__={"props":{"apiKey":"ashby-public-key-999"}};</script></html>';

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockBoardHtml,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://jobs.ashbyhq.com/ramp/uuid-1234",
      profile: {
        firstName: "Dave",
        lastName: "Miller",
        email: "dave@example.com",
        phone: "+15555555555",
        linkedinUrl: "https://linkedin.com/in/davemiller",
        resumeBuffer: Buffer.from("%PDF-1.4 ashby pdf"),
        resumeFilename: "dave_resume.pdf",
        customAnswers: {
          "field_years_experience": "6",
        },
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Call 1: Fetch org key from board
    expect(mockFetch.mock.calls[0][0]).toBe("https://jobs.ashbyhq.com/ramp");
    // Call 2: Submit to API
    expect(mockFetch.mock.calls[1][0]).toBe("https://jobs.ashbyhq.com/api/applicationForm.submit");

    const formData = mockFetch.mock.calls[1][1].body as FormData;
    expect(formData.get("apiKey")).toBe("ashby-public-key-999");
    expect(formData.get("jobPostingId")).toBe("uuid-1234");
    expect(formData.get("applicationForm[_systemfield_firstName]")).toBe("Dave");
    expect(formData.get("applicationForm[_systemfield_email]")).toBe("dave@example.com");
    expect(formData.get("applicationForm[field_years_experience]")).toBe("6");

    expect(result.success).toBe(true);
    expect(result.status).toBe("applied");
  });

  it("handles missing org key gracefully with skipped status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://jobs.ashbyhq.com/ramp/uuid-1234",
      profile: {
        firstName: "Dave",
        lastName: "Miller",
        email: "dave@example.com",
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("organization key");
  });
});
