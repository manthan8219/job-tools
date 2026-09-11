import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resumeService } from "../../resume/services/resumeService.js";
import { CreateResumeSchema } from "../../resume/models/resume.js";
import { withAuth } from "../../auth/middleware.js";

// We extend the schema because the middleware injects authUserId
const CreateResumeInputWithAuth = CreateResumeSchema.extend({
  authUserId: z.string().optional(),
});

export const createResumeTool = createTool({
  id: "create-resume",
  description: "Creates a new resume in the database with heavily nested experience and skills.",
  inputSchema: CreateResumeInputWithAuth,
  execute: withAuth(async (input: z.infer<typeof CreateResumeInputWithAuth>) => {
    try {
      const userId = input.authUserId as string; // Guaranteed by middleware
      
      const resume = await resumeService.createResume(userId, input);
      return {
        success: true,
        message: `Resume created successfully with ID ${resume.id}`,
        resume,
      };
    } catch (error: any) {
      return { success: false, error: error.name || "Error", message: error.message };
    }
  }),
});

const SearchResumeInput = z.object({
  jobEmbedding: z.array(z.number()).describe("The vector embedding of the job description requirements"),
  authUserId: z.string().optional(),
});

export const searchSimilarResumesTool = createTool({
  id: "search-similar-resumes",
  description: "Mathematically searches the user's resumes against a job description embedding using MongoDB Atlas Vector Search.",
  inputSchema: SearchResumeInput,
  execute: withAuth(async (input: z.infer<typeof SearchResumeInput>) => {
    try {
      const userId = input.authUserId as string; // Guaranteed by middleware
      
      const matches = await resumeService.searchSimilarResumes(userId, input.jobEmbedding);
      return {
        success: true,
        message: `Found ${matches.length} matching resumes.`,
        matches,
      };
    } catch (error: any) {
      return { success: false, error: error.name || "Error", message: error.message };
    }
  }),
});
