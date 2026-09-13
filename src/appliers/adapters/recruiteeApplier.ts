import { BaseJobApplierAdapter } from "../baseApplier.js";
import { ApplyRequest, ApplyResult } from "../types.js";
import { detectJobAts } from "../detector.js";
import { logger } from "../../utils/index.js";

export class RecruiteeJobApplierAdapter extends BaseJobApplierAdapter {
  readonly name = "RecruiteeJobApplierAdapter";
  readonly provider = "recruitee" as const;

  matches(jobUrl: string): boolean {
    return detectJobAts(jobUrl).provider === "recruitee";
  }

  protected async executeApply(request: ApplyRequest): Promise<ApplyResult> {
    const detected = detectJobAts(request.jobUrl);
    const board = request.companyBoard || detected.board;
    const offerSlug = request.jobId || detected.jobId;

    if (!board || !offerSlug) {
      return {
        success: false,
        status: "failed",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: `Could not parse Recruitee board and offer slug from ${request.jobUrl}`,
      };
    }

    const applyUrl = `https://${board}.recruitee.com/api/offers/${offerSlug}/candidates`;
    logger.info(`[${this.name}] Submitting candidate to: ${applyUrl}`);

    const { profile } = request;
    const formData = new FormData();

    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    formData.append("candidate[name]", fullName);
    formData.append("candidate[email]", profile.email);
    if (profile.phone) {
      formData.append("candidate[phone]", profile.phone);
    }
    if (profile.coverLetter) {
      formData.append("candidate[cover_letter]", profile.coverLetter);
    }

    if (profile.resumeBuffer) {
      const filename = profile.resumeFilename || "resume.pdf";
      const blob = new Blob([new Uint8Array(profile.resumeBuffer)], { type: "application/pdf" });
      formData.append("candidate[cv]", blob, filename);
    }

    // Support open screening questions and consent checkboxes
    if (profile.customAnswers) {
      let idx = 0;
      for (const [questionId, answer] of Object.entries(profile.customAnswers)) {
        formData.append(`candidate[open_questions_attributes][${idx}][open_question_id]`, questionId);
        formData.append(`candidate[open_questions_attributes][${idx}][content]`, String(answer));
        idx++;
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
          name: fullName,
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
        reason: `Recruitee rejected submission (HTTP ${response.status}): ${responseText.slice(0, 200) || "May require additional screening questions or GDPR acknowledgement"}`,
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
