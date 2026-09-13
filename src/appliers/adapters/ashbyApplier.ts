import { BaseJobApplierAdapter } from "../baseApplier.js";
import { ApplyRequest, ApplyResult } from "../types.js";
import { detectJobAts } from "../detector.js";
import { logger } from "../../utils/index.js";

export class AshbyJobApplierAdapter extends BaseJobApplierAdapter {
  readonly name = "AshbyJobApplierAdapter";
  readonly provider = "ashby" as const;

  matches(jobUrl: string): boolean {
    return detectJobAts(jobUrl).provider === "ashby";
  }

  /**
   * Fetches the board's public submission key from the Ashby job board page.
   */
  async fetchOrgApiKey(boardSlug: string): Promise<string | null> {
    try {
      const pageUrl = `https://jobs.ashbyhq.com/${boardSlug}`;
      const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) return null;
      const html = await response.text();

      // Look for "apiKey":"..." in Next.js hydration payload or HTML
      const marker = '"apiKey":"';
      const idx = html.indexOf(marker);
      if (idx !== -1) {
        const start = idx + marker.length;
        const end = html.indexOf('"', start);
        if (end !== -1) {
          const key = html.slice(start, end).trim();
          if (key) return key;
        }
      }
      return null;
    } catch {
      return null;
    }
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
        reason: `Could not parse Ashby board and jobId from ${request.jobUrl}`,
      };
    }

    const apiKey = await this.fetchOrgApiKey(board);
    if (!apiKey) {
      return {
        success: false,
        status: "skipped",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: `Could not retrieve public Ashby organization key for ${board} — apply manually.`,
      };
    }

    const submitUrl = "https://jobs.ashbyhq.com/api/applicationForm.submit";
    logger.info(`[${this.name}] Submitting application to Ashby API: ${submitUrl}`);

    const { profile } = request;
    const formData = new FormData();

    formData.append("apiKey", apiKey);
    formData.append("jobPostingId", jobId);
    formData.append("applicationForm[_systemfield_firstName]", profile.firstName);
    formData.append("applicationForm[_systemfield_lastName]", profile.lastName);
    formData.append("applicationForm[_systemfield_email]", profile.email);
    if (profile.phone) {
      formData.append("applicationForm[_systemfield_phone]", profile.phone);
    }
    if (profile.linkedinUrl) {
      formData.append("applicationForm[_systemfield_linkedIn]", profile.linkedinUrl);
    }

    if (profile.resumeBuffer) {
      const filename = profile.resumeFilename || "resume.pdf";
      const blob = new Blob([new Uint8Array(profile.resumeBuffer)], { type: "application/pdf" });
      formData.append("applicationForm[_systemfield_resume]", blob, filename);
    }

    // Support custom screening questions
    if (profile.customAnswers) {
      for (const [key, val] of Object.entries(profile.customAnswers)) {
        const fieldName = key.startsWith("applicationForm[") ? key : `applicationForm[${key}]`;
        if (Array.isArray(val)) {
          for (const item of val) {
            formData.append(`${fieldName}[]`, String(item));
          }
        } else {
          formData.append(fieldName, String(val));
        }
      }
    }

    const response = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: formData,
    });

    if (response.status === 200 || response.status === 201) {
      return {
        success: true,
        status: "applied",
        provider: this.provider,
        jobUrl: request.jobUrl,
        submittedAt: new Date(),
        submittedPayload: {
          jobPostingId: jobId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
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
        reason: `Ashby rejected submission (HTTP ${response.status}): ${responseText.slice(0, 200) || "Missing custom required questions"}`,
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
