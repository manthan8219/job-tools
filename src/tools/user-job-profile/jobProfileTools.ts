import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { jobProfileService } from "../../user-job-profile/services/jobProfileService.js";
import { UserJobProfileSchema } from "../../user-job-profile/models/jobProfile.js";

export const getJobProfileTool = createTool({
  id: "get-job-profile",
  description: "Retrieves the user's job search preferences (titles, locations, expected salary, skills, etc.).",
  inputSchema: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  execute: async (input) => {
    try {
      const profile = await jobProfileService.getProfile(input.userId);
      return { success: true, data: profile };
    } catch (error: any) {
      return { success: false, error: error.name || "Error", message: error.message };
    }
  },
});

export const upsertJobProfileTool = createTool({
  id: "upsert-job-profile",
  description: "Creates or updates the user's job search preferences (titles, locations, etc).",
  inputSchema: UserJobProfileSchema,
  execute: async (input) => {
    try {
      const result = await jobProfileService.upsertProfile(input);
      return { success: true, message: "Job profile updated successfully", data: result };
    } catch (error: any) {
      return { success: false, error: error.name || "Error", message: error.message };
    }
  },
});
