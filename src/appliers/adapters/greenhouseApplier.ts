import { BaseJobApplierAdapter } from "../baseApplier.js";
import { ApplyRequest, ApplyResult } from "../types.js";
import { detectJobAts } from "../detector.js";
import { logger } from "../../utils/index.js";

export class GreenhouseJobApplierAdapter extends BaseJobApplierAdapter {
  readonly name = "GreenhouseJobApplierAdapter";
  readonly provider = "greenhouse" as const;

  matches(jobUrl: string): boolean {
    return detectJobAts(jobUrl).provider === "greenhouse";
  }

  protected async executeApply(request: ApplyRequest): Promise<ApplyResult> {
    const detected = detectJobAts(request.jobUrl);
    const board = request.companyBoard || detected.board;
    const jobId = request.jobId || detected.jobId;

    if (!board || !jobId) {
      return {
        success: false,
        status: "failed",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: `Could not parse Greenhouse board and jobId from ${request.jobUrl}`,
      };
    }

    const submitUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`;
    logger.info(`[${this.name}] Submitting candidate to Greenhouse API: ${submitUrl}`);

    const { profile } = request;

    const payload: Record<string, unknown> = {
      first_name: profile.firstName,
      last_name: profile.lastName,
      email: profile.email,
      phone: profile.phone || "",
      cover_letter_text: profile.coverLetter || "",
    };

    if (profile.resumeBuffer) {
      payload.resume_text = profile.resumeBuffer.toString("base64");
    }

    if (profile.customAnswers) {
      payload.answers_attributes = profile.customAnswers;
    }

    const response = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        status: "applied",
        provider: this.provider,
        jobUrl: request.jobUrl,
        submittedAt: new Date(),
        submittedPayload: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          phone: profile.phone,
        },
      };
    }

    const responseText = await response.text().catch(() => "");
    // Greenhouse returns 400 (missing captcha token) or 428 (precondition required / captcha token invalid)
    if (response.status === 400 || response.status === 428) {
      return {
        success: false,
        status: "skipped",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: "Greenhouse requires reCAPTCHA Enterprise verification for this company board — apply manually in browser.",
      };
    }

    return {
      success: false,
      status: "failed",
      provider: this.provider,
      jobUrl: request.jobUrl,
      reason: `HTTP ${response.status}: ${responseText.slice(0, 300)}`,
    };
  }
}
