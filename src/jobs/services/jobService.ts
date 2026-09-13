import { createHash } from "node:crypto";
import { JobRepository } from "../repositories/jobRepository.js";
import { LocationRepository } from "../repositories/locationRepository.js";
import { Job, CreateJobInput, JobFilter, JobSearchResult, ExperienceLevelEnum } from "../models/job.js";
import { ScrapedJob } from "../../scrapers/types.js";
import { logger } from "../../utils/index.js";

const COMMON_TECH_SKILLS = [
  "TypeScript", "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "C++", "C#",
  "React", "React Native", "Next.js", "Vue", "Angular", "Node.js", "Express", "FastAPI",
  "Django", "Ruby on Rails", "Spring Boot", "GraphQL", "REST", "PostgreSQL", "MySQL",
  "MongoDB", "Redis", "Elasticsearch", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
  "Terraform", "CI/CD", "Linux", "Git", "Kafka", "RabbitMQ", "Snowflake", "dbt",
  "Airflow", "PyTorch", "TensorFlow", "OpenAI", "LLM", "Machine Learning",
];

export class JobService {
  constructor(
    private jobRepo = new JobRepository(),
    private locationRepo = new LocationRepository()
  ) {}

  /**
   * Generates a deterministic deduplication hash for a job posting
   */
  generateJobKey(company: string, title: string, location?: string): string {
    const normCompany = company.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const normTitle = title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const normLoc = (location || "remote").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const raw = `${normCompany}|${normTitle}|${normLoc}`;
    return createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Extracts recognized tech skills from text, categories, and title
   */
  extractSkills(text?: string, categories: string[] = []): string[] {
    const found = new Set<string>();
    const fullCorpus = `${categories.join(" ")} ${text || ""}`.toLowerCase();

    for (const skill of COMMON_TECH_SKILLS) {
      const lower = skill.toLowerCase();
      // Match with word boundaries
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-zA-Z0-9#+])`, "i");
      if (regex.test(fullCorpus)) {
        found.add(skill);
      }
    }

    return Array.from(found);
  }

  /**
   * Infers seniority level from job title
   */
  inferExperienceLevel(title: string): Job["experienceLevel"] {
    const t = title.toLowerCase();
    if (t.includes("intern") || t.includes("co-op") || t.includes("apprentice")) return "entry";
    if (t.includes("junior") || t.includes("associate") || t.includes("entry")) return "entry";
    if (t.includes("staff") || t.includes("principal") || t.includes("lead") || t.includes("architect")) return "lead";
    if (t.includes("director") || t.includes("vp") || t.includes("head of") || t.includes("executive")) return "executive";
    if (t.includes("senior") || t.includes("sr.") || t.includes("sr ")) return "senior";
    if (t.includes("mid") || t.includes("intermediate")) return "mid";
    return "unknown";
  }

  /**
   * Ingests a ScrapedJob entity into the PostgreSQL database with hierarchical location resolution
   */
  async ingestScrapedJob(scraped: ScrapedJob): Promise<Job> {
    const jobKey = this.generateJobKey(scraped.company, scraped.title, scraped.location);

    // Resolve location in the hierarchy tree
    const matchedLocation = await this.locationRepo.findMatchingLocation(scraped.location);
    const isWorldwide =
      Boolean(scraped.workArrangement === "remote") &&
      (!scraped.location ||
        scraped.location.toLowerCase().includes("worldwide") ||
        scraped.location.toLowerCase().includes("global") ||
        scraped.location.toLowerCase().includes("anywhere"));

    // Extract tech skills
    const skills = this.extractSkills(`${scraped.title} ${scraped.description || ""} ${scraped.excerpt || ""}`, scraped.categories);
    const experienceLevel = this.inferExperienceLevel(scraped.title);

    const jobInput: CreateJobInput = {
      jobKey,
      externalId: scraped.id,
      source: scraped.source,
      title: scraped.title,
      company: scraped.company,
      companySlug: scraped.company.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
      description: scraped.description,
      excerpt: scraped.excerpt,
      applyUrl: scraped.url,
      applyType: "url",
      employmentType: scraped.employmentType,
      workArrangement: scraped.workArrangement,
      experienceLevel,
      categories: scraped.categories || [],
      skills,
      salaryMin: scraped.salaryMin,
      salaryMax: scraped.salaryMax,
      salaryCurrency: scraped.salaryCurrency || "USD",
      salaryPeriod: scraped.salaryPeriod || "annual",
      primaryLocationId: matchedLocation?.id || null,
      rawLocation: scraped.location,
      isWorldwide,
      status: "active",
      postedAt: scraped.postedAt,
      lastSeenAt: new Date(),
    };

    const savedJob = await this.jobRepo.upsertJob(jobInput);
    logger.info(`[JobService] Ingested job: "${savedJob.title}" at "${savedJob.company}" [${savedJob.source}] (key: ${jobKey.slice(0, 8)})`);
    return savedJob;
  }

  /**
   * Search jobs from PostgreSQL with location tree, role query, and skills filters
   */
  async searchJobs(filters: JobFilter): Promise<JobSearchResult> {
    return await this.jobRepo.findJobs(filters);
  }

  /**
   * Retrieves full job details by ID
   */
  async getJobDetails(id: string): Promise<Job | null> {
    return await this.jobRepo.findById(id);
  }
}
