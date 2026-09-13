import { z } from "zod";

// Heavily nested structure perfectly suited for MongoDB
export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.array(z.string()).describe("Bullet points of achievements"),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  graduationYear: z.string().optional(),
});

export const ResumeSchema = z.object({
  // In MongoDB this maps to _id, but we keep it as id in the app layer
  id: z.string().uuid().describe("Unique identifier for the resume"),
  userId: z.string().uuid().describe("The user this resume belongs to"),
  jobId: z.string().uuid().optional().describe("Unique identifier of the target job this tailored resume was crafted for"),
  
  title: z.string().describe("e.g., 'Senior Frontend Engineer Resume'"),
  targetRole: z.string().optional().describe("Target job title or role"),
  summary: z.string().optional().describe("Professional executive summary statement"),
  markdownContent: z.string().optional().describe("Complete ATS-optimized markdown content of the resume"),
  
  // The raw JSON data
  skills: z.array(z.string()).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  
  // HR evaluation records
  hrScore: z.number().optional().describe("Passing HR screener score (0-100)"),
  hrFeedback: z.record(z.any()).optional().describe("HR review evaluation breakdown, strengths, and critique"),

  // The embedding vector for AI semantic matching
  embedding: z.array(z.number()).optional().describe("Vector representation of the resume for semantic search"),
  
  // Rendered PDF / storage link
  pdfUrl: z.string().optional().describe("Public or presigned URL to view/download the rendered resume PDF"),
  fileKey: z.string().optional().describe("Storage key in the blob/local storage for file retrieval"),

  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;

export const CreateResumeSchema = ResumeSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>;
