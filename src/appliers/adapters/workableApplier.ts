import { BaseJobApplierAdapter } from "../baseApplier.js";
import { ApplyRequest, ApplyResult } from "../types.js";
import { detectJobAts } from "../detector.js";
import { logger } from "../../utils/index.js";

export class WorkableJobApplierAdapter extends BaseJobApplierAdapter {
  readonly name = "WorkableJobApplierAdapter";
  readonly provider = "workable" as const;

  matches(jobUrl: string): boolean {
    return detectJobAts(jobUrl).provider === "workable";
  }

  protected async executeApply(request: ApplyRequest): Promise<ApplyResult> {
    const detected = detectJobAts(request.jobUrl);
    const board = request.companyBoard || detected.board;
    const shortcode = request.jobId || detected.jobId;

    if (!board || !shortcode) {
      return {
        success: false,
        status: "failed",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: `Could not parse Workable board and job shortcode from ${request.jobUrl}`,
      };
    }

    const applyUrl = `https://apply.workable.com/api/v3/accounts/${board}/jobs/${shortcode}/candidates`;
    logger.info(`[${this.name}] Submitting candidate to: ${applyUrl}`);

    const { profile } = request;
    const formData = new FormData();

    formData.append("firstname", profile.firstName);
    formData.append("lastname", profile.lastName);
    formData.append("email", profile.email);
    if (profile.phone) {
      formData.append("phone", profile.phone);
    }
    if (profile.coverLetter) {
      formData.append("cover_letter", profile.coverLetter);
    }

    // Attach actual resume file (fixing the empty resume_url bug from terminal-job)
    if (profile.resumeBuffer) {
      const filename = profile.resumeFilename || "resume.pdf";
      const blob = new Blob([new Uint8Array(profile.resumeBuffer)], { type: "application/pdf" });
      formData.append("resume", blob, filename);
    }

    if (profile.customAnswers) {
      for (const [key, val] of Object.entries(profile.customAnswers)) {
        formData.append(key, String(val));
      }
    }

    const response = await fetch(applyUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: formData,
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        status: "applied",
        provider: this.provider,
        jobUrl: request.jobUrl,
        submittedAt: new Date(),
        submittedPayload: {
          firstname: profile.firstName,
          lastname: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          hasResume: Boolean(profile.resumeBuffer),
        },
      };
    }

    const responseText = await response.text().catch(() => "");
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      return {
        success: false,
        status: "skipped",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: `Workable rejected submission (HTTP ${response.status}): ${responseText.slice(0, 200) || "Missing custom questions or incomplete form"}`,
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
