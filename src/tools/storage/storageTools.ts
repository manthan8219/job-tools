import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { storageService } from "../../storage/services/storageService.js";

export const uploadResumeFileTool = createTool({
  id: "uploadResumeFile",
  description:
    "Uploads a locally generated resume file (PDF, DOCX, etc.) directly into blob or local storage. Use this tool immediately after compiling a tailored resume with convertMdToPdf or convertLatexToPdf. When jobId is provided, links the resume and stored file specifically to that job posting. If resumeId is provided, updates the resume record in MongoDB and Redis.",
  inputSchema: z.object({
    userId: z
      .string()
      .uuid()
      .describe("UUID of the user/candidate who owns this resume. Example: '550e8400-e29b-41d4-a716-446655440000'"),
    jobId: z
      .string()
      .optional()
      .describe("Optional identifier of the target job posting this tailored resume was created for. Organizes the file under the job hierarchy and links the resume to the job."),
    resumeId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Optional UUID of the resume to link with. When provided, automatically updates the candidate's resume record in MongoDB and Redis with the public/download URL."
      ),
    filePath: z
      .string()
      .describe(
        "Absolute or relative filesystem path to the compiled resume file to upload (e.g., '/tmp/John_Doe_Software_Engineer.pdf')"
      ),
    fileName: z
      .string()
      .default("resume.pdf")
      .describe(
        "Desired destination file name with extension (e.g., 'John_Doe_Senior_Backend_Engineer_Resume.pdf'). Defaults to 'resume.pdf'"
      ),
    contentType: z
      .string()
      .default("application/pdf")
      .describe("MIME type of the uploaded file. Defaults to 'application/pdf'"),
  }),
  execute: async ({ userId, jobId, resumeId, filePath, fileName, contentType }) => {
    return await storageService.uploadResumeFile({
      userId,
      jobId,
      resumeId,
      filePath,
      fileName,
      contentType,
    });
  },
});

export const generateResumeUploadUrlTool = createTool({
  id: "generateResumeUploadUrl",
  description:
    "Generates a pre-signed HTTP upload URL (for Cloudflare R2, AWS S3, MinIO, or the local server) allowing direct binary file upload via HTTP PUT. When jobId is provided, structures the target storage path under that job.",
  inputSchema: z.object({
    userId: z
      .string()
      .uuid()
      .describe("UUID of the candidate/user. Example: '550e8400-e29b-41d4-a716-446655440000'"),
    jobId: z
      .string()
      .optional()
      .describe("Optional identifier of the target job posting this tailored resume is being prepared for."),
    resumeId: z
      .string()
      .uuid()
      .optional()
      .describe("Optional UUID of the specific resume to associate this upload with."),
    fileName: z
      .string()
      .default("resume.pdf")
      .describe("Target file name to store (e.g., 'Jane_Smith_Resume.pdf'). Defaults to 'resume.pdf'"),
    contentType: z
      .string()
      .default("application/pdf")
      .describe("MIME type expected during upload (e.g., 'application/pdf'). Defaults to 'application/pdf'"),
    expiresInSeconds: z
      .number()
      .default(900)
      .describe("Validity window in seconds for the upload link (default: 900 seconds = 15 minutes)"),
  }),
  execute: async ({ userId, jobId, resumeId, fileName, contentType, expiresInSeconds }) => {
    return await storageService.generateResumeUploadUrl({
      userId,
      jobId,
      resumeId,
      fileName,
      contentType,
      expiresInSeconds,
    });
  },
});

export const getResumeDownloadUrlTool = createTool({
  id: "getResumeDownloadUrl",
  description:
    "Generates or retrieves a secure download/view URL for an existing resume stored in blob or local storage using its storage fileKey. Returns either a CDN link or a time-limited pre-signed GET URL.",
  inputSchema: z.object({
    fileKey: z
      .string()
      .describe(
        "The unique storage key of the stored file (e.g., 'users/550e8400.../resumes/1726207200000-John_Resume.pdf')"
      ),
    expiresInSeconds: z
      .number()
      .default(3600)
      .describe("Expiry time in seconds for private/presigned download URLs (default: 3600 seconds = 1 hour)"),
  }),
  execute: async ({ fileKey, expiresInSeconds }) => {
    return await storageService.getResumeDownloadUrl({
      fileKey,
      expiresInSeconds,
    });
  },
});

export const deleteResumeFileTool = createTool({
  id: "deleteResumeFile",
  description:
    "Permanently deletes a stored resume file from blob or local storage using its storage fileKey. Use to remove outdated, discarded, or replaced resume files.",
  inputSchema: z.object({
    fileKey: z
      .string()
      .describe("The unique storage key of the file to delete (e.g., 'users/123/resumes/resume.pdf')"),
  }),
  execute: async ({ fileKey }) => {
    const success = await storageService.deleteResumeFile(fileKey);
    return { success, fileKey };
  },
});
