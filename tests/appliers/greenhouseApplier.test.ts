import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GreenhouseJobApplierAdapter } from "../../src/appliers/adapters/greenhouseApplier.js";

describe("GreenhouseJobApplierAdapter", () => {
  let adapter: GreenhouseJobApplierAdapter;

  beforeEach(() => {
    adapter = new GreenhouseJobApplierAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports correct identity and matcher", () => {
    expect(adapter.name).toBe("GreenhouseJobApplierAdapter");
    expect(adapter.provider).toBe("greenhouse");
    expect(adapter.matches("https://boards.greenhouse.io/stripe/jobs/12345")).toBe(true);
    expect(adapter.matches("https://example.com/jobs/12345")).toBe(false);
  });

  it("submits application and returns applied status on 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://boards.greenhouse.io/stripe/jobs/12345",
      profile: {
        firstName: "Frank",
        lastName: "Underwood",
        email: "frank@example.com",
        phone: "+1112223333",
        coverLetter: "Cover letter text",
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345");
    expect(options.method).toBe("POST");

    const payload = JSON.parse(options.body as string);
    expect(payload.first_name).toBe("Frank");
    expect(payload.last_name).toBe("Underwood");
    expect(payload.email).toBe("frank@example.com");

    expect(result.success).toBe(true);
    expect(result.status).toBe("applied");
  });

  it("detects reCAPTCHA Enterprise block (400 or 428) and marks skipped", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      text: async () => "Missing reCAPTCHA token",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://boards.greenhouse.io/stripe/jobs/12345",
      profile: {
        firstName: "Frank",
        lastName: "Underwood",
        email: "frank@example.com",
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("reCAPTCHA Enterprise");
  });
});
