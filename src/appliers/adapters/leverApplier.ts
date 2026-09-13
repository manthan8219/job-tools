import { BaseJobApplierAdapter } from "../baseApplier.js";
import { ApplyRequest, ApplyResult } from "../types.js";
import { detectJobAts } from "../detector.js";
import { logger } from "../../utils/index.js";

export class LeverJobApplierAdapter extends BaseJobApplierAdapter {
  readonly name = "LeverJobApplierAdapter";
  readonly provider = "lever" as const;

  matches(jobUrl: string): boolean {
    return detectJobAts(jobUrl).provider === "lever";
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
        reason: `Could not parse Lever company board and jobId from ${request.jobUrl}`,
      };
    }

    const applyUrl = `https://jobs.lever.co/${board}/${jobId}/apply`;
    logger.info(`[${this.name}] Submitting multipart to: ${applyUrl}`);

    const { profile } = request;
    const formData = new FormData();

    // Standard candidate fields
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    formData.append("name", fullName);
    formData.append("email", profile.email);
    if (profile.phone) formData.append("phone", profile.phone);

    // Fixed bug: use current company / title, NOT city
    if (profile.currentCompany) {
      formData.append("org", profile.currentCompany);
    }

    // Social & web links
    if (profile.linkedinUrl) {
      formData.append("urls[LinkedIn]", profile.linkedinUrl);
    }
    if (profile.githubUrl) {
      formData.append("urls[GitHub]", profile.githubUrl);
    }
    if (profile.portfolioUrl) {
      formData.append("urls[Portfolio]", profile.portfolioUrl);
    }

    // Cover letter / comments
    if (profile.coverLetter) {
      formData.append("comments", profile.coverLetter);
    }

    // Attach resume file if available
    if (profile.resumeBuffer) {
      const filename = profile.resumeFilename || "resume.pdf";
      const blob = new Blob([new Uint8Array(profile.resumeBuffer)], { type: "application/pdf" });
      formData.append("resume", blob, filename);
    }

    // Custom screening question answers if provided
    if (profile.customAnswers) {
      for (const [key, value] of Object.entries(profile.customAnswers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            formData.append(`${key}[]`, String(item));
          }
        } else {
          formData.append(key, String(value));
        }
      }
    }

    const response = await fetch(applyUrl, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: formData,
      redirect: "manual", // Lever redirects to /thanks on success (302)
    });

    const isSuccess =
      response.status === 200 ||
      response.status === 201 ||
      response.status === 302 ||
      (response.status >= 300 && response.status < 400);

    if (isSuccess) {
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
          currentCompany: profile.currentCompany,
          linkedinUrl: profile.linkedinUrl,
          hasResume: Boolean(profile.resumeBuffer),
        },
      };
    }

    const responseText = await response.text().catch(() => "");
    // If Lever returned 4xx (e.g. hCaptcha required or missing custom questions)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      const isCaptcha = responseText.toLowerCase().includes("captcha") || responseText.toLowerCase().includes("hcaptcha");
      return {
        success: false,
        status: "skipped",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: isCaptcha
          ? "Lever requires hCaptcha verification for this posting — apply manually."
          : `Lever rejected submission (HTTP ${response.status}): ${responseText.slice(0, 200) || "Missing required fields or screening questions"}`,
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
