import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { defaultApplierRegistry } from "../../appliers/applierRegistry.js";
import { detectJobAts } from "../../appliers/detector.js";
import { ApplyJobInputSchema } from "../../appliers/types.js";

export const applyToJobTool = createTool({
  id: "apply-to-job",
  description:
    "Submits a job application directly via HTTP API for supported ATS platforms (Lever, Ashby, Recruitee, Workable, and non-captcha Greenhouse boards). Automatically packages the applicant details and attached PDF resume.",
  inputSchema: ApplyJobInputSchema,
  execute: async (input) => {
    try {
      let resumeBuffer: Buffer | undefined;
      if (input.resumeBase64) {
        resumeBuffer = Buffer.from(input.resumeBase64, "base64");
      }

      const result = await defaultApplierRegistry.applyToJob({
        jobUrl: input.jobUrl,
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
          currentCompany: input.currentCompany,
          currentTitle: input.currentTitle,
          city: input.city,
          country: input.country,
          requiresSponsorship: input.requiresSponsorship,
          expectedSalary: input.expectedSalary,
          coverLetter: input.coverLetter,
          resumeBuffer,
          resumeFilename: input.resumeFilename,
          customAnswers: input.customAnswers,
        },
      });

      return {
        success: result.success,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.name || "ApplyError",
        message: error?.message || String(error),
      };
    }
  },
});

export const detectJobAtsTool = createTool({
  id: "detect-job-ats",
  description:
    "Analyzes a job posting URL to identify the underlying Applicant Tracking System (ATS) platform (e.g. Lever, Ashby, Recruitee, Workable, Greenhouse, Workday) and checks if direct API application is supported.",
  inputSchema: z.object({
    jobUrl: z.string().url().describe("The URL of the job posting to analyze"),
  }),
  execute: async (input) => {
    try {
      const detected = detectJobAts(input.jobUrl);
      return {
        success: true,
        data: detected,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.name || "DetectionError",
        message: error?.message || String(error),
      };
    }
  },
});
