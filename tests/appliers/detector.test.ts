import { describe, it, expect } from "vitest";
import { detectJobAts } from "../../src/appliers/detector.js";

describe("detectJobAts", () => {
  it("should accurately detect Lever URLs and extract board and jobId", () => {
    const res = detectJobAts("https://jobs.lever.co/palantir/abc-123-def");
    expect(res.provider).toBe("lever");
    expect(res.board).toBe("palantir");
    expect(res.jobId).toBe("abc-123-def");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Ashby URLs and extract board and jobId", () => {
    const res = detectJobAts("https://jobs.ashbyhq.com/ramp/456-789-ghi");
    expect(res.provider).toBe("ashby");
    expect(res.board).toBe("ramp");
    expect(res.jobId).toBe("456-789-ghi");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Recruitee URLs (/o/ slug format)", () => {
    const res = detectJobAts("https://miro.recruitee.com/o/senior-backend-engineer");
    expect(res.provider).toBe("recruitee");
    expect(res.board).toBe("miro");
    expect(res.jobId).toBe("senior-backend-engineer");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Recruitee URLs (/l/offers/ slug format)", () => {
    const res = detectJobAts("https://hotjar.recruitee.com/l/offers/tech-lead-node");
    expect(res.provider).toBe("recruitee");
    expect(res.board).toBe("hotjar");
    expect(res.jobId).toBe("tech-lead-node");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Workable URLs (/j/ shortcode format)", () => {
    const res = detectJobAts("https://apply.workable.com/typeform/j/9876543210/");
    expect(res.provider).toBe("workable");
    expect(res.board).toBe("typeform");
    expect(res.jobId).toBe("9876543210");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Greenhouse URLs (/board/jobs/id format)", () => {
    const res = detectJobAts("https://boards.greenhouse.io/stripe/jobs/112233");
    expect(res.provider).toBe("greenhouse");
    expect(res.board).toBe("stripe");
    expect(res.jobId).toBe("112233");
    expect(res.isApiSupported).toBe(true);
  });

  it("should accurately detect Greenhouse embed job_app URLs", () => {
    const res = detectJobAts("https://boards.greenhouse.io/embed/job_app?for=github&token=445566");
    expect(res.provider).toBe("greenhouse");
    expect(res.board).toBe("github");
    expect(res.jobId).toBe("445566");
    expect(res.isApiSupported).toBe(true);
  });

  it("should return unknown and isApiSupported=false for non-ATS URLs", () => {
    const res = detectJobAts("https://example.com/careers/software-engineer");
    expect(res.provider).toBe("unknown");
    expect(res.isApiSupported).toBe(false);
  });
});
