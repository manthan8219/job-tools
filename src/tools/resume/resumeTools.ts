import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resumeService } from "../../resume/services/resumeService.js";
import { CreateResumeSchema, ResumeSchema } from "../../resume/models/resume.js";
import { withAuth } from "../../auth/middleware.js";

// We extend the schema because the middleware injects authUserId
const CreateResumeInputWithAuth = CreateResumeSchema.extend({
  authUserId: z.string().optional(),
});

export const createResumeTool = createTool({
  id: "create-resume",
  description: "Creates a new resume in MongoDB and automatically caches it in Redis for high-frequency retrieval.",
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

const GetResumeInput = z.object({
  id: z.string().describe("Unique identifier of the resume to fetch"),
  authUserId: z.string().optional(),
});

export const getResumeTool = createTool({
  id: "get-resume",
  description: "Retrieves a candidate's resume by ID, querying Redis cache first for sub-millisecond retrieval.",
  inputSchema: GetResumeInput,
  execute: withAuth(async (input: z.infer<typeof GetResumeInput>) => {
    try {
      const userId = input.authUserId as string;
      const resume = await resumeService.getResume(input.id, userId);
      return {
        success: true,
        resume,
        message: `Successfully retrieved resume ${input.id}`,
      };
    } catch (error: any) {
      return { success: false, error: error.name || "Error", message: error.message };
    }
  }),
});

const GetUserResumesInput = z.object({
  authUserId: z.string().optional(),
});

export const getUserResumesTool = createTool({
  id: "get-user-resumes",
  description: "Retrieves all resumes for the current authenticated user, utilizing Redis cache.",
  inputSchema: GetUserResumesInput,
  execute: withAuth(async (input: z.infer<typeof GetUserResumesInput>) => {
    try {
      const userId = input.authUserId as string;
      const resumes = await resumeService.getUserResumes(userId);
      return {
        success: true,
        totalFound: resumes.length,
        resumes,
      };
    } catch (error: any) {
      return { success: false, totalFound: 0, resumes: [], error: error.name || "Error", message: error.message };
    }
  }),
});

const GetLatestResumeInput = z.object({
  authUserId: z.string().optional(),
});

export const getLatestResumeTool = createTool({
  id: "get-latest-resume",
  description: "Retrieves the user's latest or active resume directly from Redis cache or database.",
  inputSchema: GetLatestResumeInput,
  execute: withAuth(async (input: z.infer<typeof GetLatestResumeInput>) => {
    try {
      const userId = input.authUserId as string;
      const resume = await resumeService.getLatestResume(userId);
      if (!resume) {
        return {
          success: false,
          resume: null,
          message: "No resumes found for this user.",
        };
      }
      return {
        success: true,
        resume,
        message: `Successfully retrieved latest resume ${resume.id}`,
      };
    } catch (error: any) {
      return { success: false, resume: null, error: error.name || "Error", message: error.message };
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

const GetResumeForJobInput = z.object({
  jobId: z.string().describe("Unique identifier of the target job posting"),
  authUserId: z.string().optional(),
});

export const getResumeForJobTool = createTool({
  id: "getResumeForJob",
  description:
    "Retrieves the candidate's tailored resume and rendered PDF URL specifically created for a given job posting.",
  inputSchema: GetResumeForJobInput,
  execute: withAuth(async (input: z.infer<typeof GetResumeForJobInput>) => {
    try {
      const userId = input.authUserId as string;
      const resume = await resumeService.getResumeForJob(userId, input.jobId);
      if (!resume) {
        return {
          success: false,
          resume: null,
          message: `No tailored resume found for job ${input.jobId}`,
        };
      }
      return {
        success: true,
        resume,
        message: `Successfully retrieved tailored resume for job ${input.jobId}`,
      };
    } catch (error: any) {
      return { success: false, resume: null, error: error.name || "Error", message: error.message };
    }
  }),
});
