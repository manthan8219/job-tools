import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecruiteeJobApplierAdapter } from "../../src/appliers/adapters/recruiteeApplier.js";

describe("RecruiteeJobApplierAdapter", () => {
  let adapter: RecruiteeJobApplierAdapter;

  beforeEach(() => {
    adapter = new RecruiteeJobApplierAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports correct identity and matcher", () => {
    expect(adapter.name).toBe("RecruiteeJobApplierAdapter");
    expect(adapter.provider).toBe("recruitee");
    expect(adapter.matches("https://miro.recruitee.com/o/backend-lead")).toBe(true);
    expect(adapter.matches("https://example.com/jobs/123")).toBe(false);
  });

  it("submits application and handles 201 Created as success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ candidate: { id: 12345 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://miro.recruitee.com/o/backend-lead",
      profile: {
        firstName: "Carol",
        lastName: "White",
        email: "carol@example.com",
        phone: "+9876543210",
        coverLetter: "Looking forward to speaking with the team.",
        resumeBuffer: Buffer.from("%PDF-1.4 test"),
        resumeFilename: "carol_cv.pdf",
        customAnswers: {
          "q1_gdpr": "I agree",
        },
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://miro.recruitee.com/api/offers/backend-lead/candidates");
    expect(options.method).toBe("POST");

    const formData = options.body as FormData;
    expect(formData.get("candidate[name]")).toBe("Carol White");
    expect(formData.get("candidate[email]")).toBe("carol@example.com");
    expect(formData.get("candidate[phone]")).toBe("+9876543210");
    expect(formData.get("candidate[cover_letter]")).toBe("Looking forward to speaking with the team.");
    expect(formData.get("candidate[open_questions_attributes][0][open_question_id]")).toBe("q1_gdpr");
    expect(formData.get("candidate[open_questions_attributes][0][content]")).toBe("I agree");

    expect(result.success).toBe(true);
    expect(result.status).toBe("applied");
  });

  it("handles 4xx validation rejection as skipped", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 422,
      ok: false,
      text: async () => "Unprocessable Entity: screening questions required",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.apply({
      jobUrl: "https://miro.recruitee.com/o/backend-lead",
      profile: {
        firstName: "Carol",
        lastName: "White",
        email: "carol@example.com",
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("skipped");
  });
});
