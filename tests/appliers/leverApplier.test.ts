import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeverJobApplierAdapter } from "../../src/appliers/adapters/leverApplier.js";

describe("LeverJobApplierAdapter", () => {
  let adapter: LeverJobApplierAdapter;

  beforeEach(() => {
    adapter = new LeverJobApplierAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports correct identity and matcher", () => {
    expect(adapter.name).toBe("LeverJobApplierAdapter");
    expect(adapter.provider).toBe("lever");
    expect(adapter.matches("https://jobs.lever.co/palantir/123")).toBe(true);
    expect(adapter.matches("https://example.com/job/123")).toBe(false);
  });

  it("submits application and handles 302 redirect as success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 302,
      ok: false, // 302 redirect
      headers: new Headers({ Location: "https://jobs.lever.co/palantir/123/thanks" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://jobs.lever.co/palantir/123",
      profile: {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        phone: "+1234567890",
        currentCompany: "Acme Corp",
        linkedinUrl: "https://linkedin.com/in/alicesmith",
        coverLetter: "Excited to apply!",
        resumeBuffer: Buffer.from("%PDF-1.4 simulated pdf"),
        resumeFilename: "alice_resume.pdf",
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://jobs.lever.co/palantir/123/apply");
    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("manual");

    // Check FormData payload
    const formData = options.body as FormData;
    expect(formData.get("name")).toBe("Alice Smith");
    expect(formData.get("email")).toBe("alice@example.com");
    expect(formData.get("org")).toBe("Acme Corp"); // Verifies the fix: NOT City
    expect(formData.get("urls[LinkedIn]")).toBe("https://linkedin.com/in/alicesmith");
    expect(formData.get("comments")).toBe("Excited to apply!");

    expect(result.success).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.provider).toBe("lever");
  });

  it("handles 4xx captcha requirement as skipped", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      text: async () => "hCaptcha verification failed",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://jobs.lever.co/palantir/123",
      profile: {
        firstName: "Bob",
        lastName: "Jones",
        email: "bob@example.com",
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("hCaptcha");
  });
});
