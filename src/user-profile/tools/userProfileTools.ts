import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { userProfileService } from "../services/userProfileService.js";
import { JobApplicationSchema, UserStatsSchema } from "../models/profile.js";

export const trackJobApplicationTool = createTool({
  id: "track-job-application",
  description: "Tracks a new job application for a user",
  inputSchema: JobApplicationSchema,
  execute: async (input) => {
    try {
      const result = await userProfileService.trackApplication(input);
      return {
        success: true,
        message: "Job application tracked successfully",
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.name || "Error",
        message: error.message,
      };
    }
  },
});

export const getUserStatsTool = createTool({
  id: "get-user-application-stats",
  description: "Retrieves statistics on the user's job applications (total applied, interviewing, etc)",
  inputSchema: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  execute: async (input) => {
    try {
      const result = await userProfileService.getStats(input.userId);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.name || "Error",
        message: error.message,
      };
    }
  },
});

export const getUserApplicationsTool = createTool({
  id: "get-user-applications",
  description: "Retrieves the full list of job applications for a user",
  inputSchema: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  execute: async (input) => {
    try {
      const result = await userProfileService.getApplications(input.userId);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.name || "Error",
        message: error.message,
      };
    }
  },
});
