import { z } from "zod";
import { BaseEntitySchema } from "../../common/models/base.js";

export const UserJobProfileSchema = z.object({
  // Core targeting
  targetTitles: z.array(z.string()).min(1, "At least one target title is required"),
  locations: z.array(z.string()).min(1, "At least one target location is required"),
  experienceYears: z.number().min(0),
  
  // Logistics
  workArrangements: z.array(z.enum(["remote", "hybrid", "on-site"])).default(["remote", "hybrid", "on-site"]),
  employmentTypes: z.array(z.enum(["full-time", "contract", "part-time"])).default(["full-time"]),
  
  // Compensation
  expectedSalaryMin: z.number().optional(),
  expectedSalaryCurrency: z.string().default("USD"),
  
  // ATS Questionnaire Defaults
  requiresSponsorship: z.boolean().default(false),
  availability: z.string().optional(),

  // Matching criteria
  mustHaveSkills: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
}).merge(BaseEntitySchema);

export type UserJobProfile = z.infer<typeof UserJobProfileSchema>;
