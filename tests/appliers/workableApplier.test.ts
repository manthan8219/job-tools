import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkableJobApplierAdapter } from "../../src/appliers/adapters/workableApplier.js";

describe("WorkableJobApplierAdapter", () => {
  let adapter: WorkableJobApplierAdapter;

  beforeEach(() => {
    adapter = new WorkableJobApplierAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports correct identity and matcher", () => {
    expect(adapter.name).toBe("WorkableJobApplierAdapter");
    expect(adapter.provider).toBe("workable");
    expect(adapter.matches("https://apply.workable.com/typeform/j/12345/")).toBe(true);
    expect(adapter.matches("https://example.com/j/12345/")).toBe(false);
  });

  it("submits application with attached resume file", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ id: "cand_999" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://apply.workable.com/typeform/j/12345/",
      profile: {
        firstName: "Eve",
        lastName: "Adams",
        email: "eve@example.com",
        phone: "+19999999999",
        coverLetter: "Excited about this opportunity.",
        resumeBuffer: Buffer.from("%PDF-1.4 workable"),
        resumeFilename: "eve_resume.pdf",
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://apply.workable.com/api/v3/accounts/typeform/jobs/12345/candidates");
    expect(options.method).toBe("POST");

    const formData = options.body as FormData;
    expect(formData.get("firstname")).toBe("Eve");
    expect(formData.get("lastname")).toBe("Eve".length > 0 ? "Adams" : "");
    expect(formData.get("email")).toBe("eve@example.com");
    expect(formData.get("resume")).toBeInstanceOf(Blob); // Verifies real file attachment!

    expect(result.success).toBe(true);
    expect(result.status).toBe("applied");
  });

  it("handles 4xx rejected candidate as skipped", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 422,
      ok: false,
      text: async () => "Unprocessable entity: custom question required",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://apply.workable.com/typeform/j/12345/",
      profile: {
        firstName: "Eve",
        lastName: "Adams",
        email: "eve@example.com",
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("skipped");
  });
});
