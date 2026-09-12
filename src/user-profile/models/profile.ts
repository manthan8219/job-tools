import { z } from "zod";

export const JobApplicationSchema = z.object({
  id: z.string().optional(),
  userId: z.string().describe("The ID of the user who applied"),
  companyName: z.string().min(1, "Company name is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  status: z.enum(["applied", "interviewing", "rejected", "offer", "withdrawn"]).default("applied"),
  jobUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  appliedDate: z.string().optional().describe("ISO date string or defaults to now"),
});

export type JobApplication = z.infer<typeof JobApplicationSchema>;

export const UserStatsSchema = z.object({
  totalApplications: z.number(),
  interviewing: z.number(),
  offers: z.number(),
  rejected: z.number(),
});

export type UserStats = z.infer<typeof UserStatsSchema>;
