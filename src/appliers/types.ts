import { z } from "zod";

export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  currentTitle?: string;
  city?: string;
  country?: string;
  experienceYears?: number;
  requiresSponsorship?: boolean;
  expectedSalary?: number;
  currency?: string;
  noticePeriod?: string;
  resumeBuffer?: Buffer;
  resumeFilename?: string;
  coverLetter?: string;
  customAnswers?: Record<string, string | boolean | string[]>;
}

export interface ApplyRequest {
  jobUrl: string;
  jobId?: string;
  companyBoard?: string;
  profile: ApplicantProfile;
}

export type ApplyStatus = "applied" | "skipped" | "failed";

export type SupportedAtsProvider =
  | "lever"
  | "recruitee"
  | "ashby"
  | "workable"
  | "greenhouse"
  | "unknown";

export interface ApplyResult {
  success: boolean;
  status: ApplyStatus;
  provider: SupportedAtsProvider;
  jobUrl: string;
  reason?: string;
  submittedAt?: Date;
  submittedPayload?: Record<string, unknown>;
}

export interface JobApplierAdapter {
  readonly name: string;
  readonly provider: SupportedAtsProvider;
  matches(jobUrl: string): boolean;
  apply(request: ApplyRequest): Promise<ApplyResult>;
}

export const ApplyJobInputSchema = z.object({
  jobUrl: z.string().url().describe("The canonical job posting apply URL"),
  firstName: z.string().min(1).describe("Applicant first name"),
  lastName: z.string().min(1).describe("Applicant last name"),
  email: z.string().email().describe("Applicant email address"),
  phone: z.string().optional().describe("Applicant contact phone number"),
  linkedinUrl: z.string().url().optional().describe("Applicant LinkedIn profile URL"),
  githubUrl: z.string().url().optional().describe("Applicant GitHub profile URL"),
  portfolioUrl: z.string().url().optional().describe("Applicant personal portfolio or website URL"),
  currentCompany: z.string().optional().describe("Applicant's current employer or organization"),
  currentTitle: z.string().optional().describe("Applicant's current job title"),
  city: z.string().optional().describe("Applicant's current city of residence"),
  country: z.string().optional().describe("Applicant's country of residence"),
  requiresSponsorship: z.boolean().optional().default(false).describe("Whether applicant requires visa sponsorship"),
  expectedSalary: z.number().optional().describe("Applicant expected salary"),
  coverLetter: z.string().optional().describe("Optional cover letter or personal note to recruiter"),
  resumeBase64: z.string().optional().describe("Optional base64-encoded PDF resume to attach"),
  resumeFilename: z.string().optional().default("resume.pdf").describe("Filename for the attached resume"),
  customAnswers: z.record(z.union([z.string(), z.boolean(), z.array(z.string())])).optional().describe("Optional answers to custom screening questions"),
});

export type ApplyJobInput = z.infer<typeof ApplyJobInputSchema>;
