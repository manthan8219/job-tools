import { resumeRepository, ResumeRepository } from "../repositories/resumeRepository.js";
import { resumeCache, ResumeCache } from "../cache/resumeCache.js";
import { CreateResumeSchema, type Resume } from "../models/resume.js";
import { NotFoundError } from "../../utils/index.js";

export class ResumeService {
  private repository: ResumeRepository;
  private cache: ResumeCache;

  constructor(repository: ResumeRepository = resumeRepository, cache: ResumeCache = resumeCache) {
    this.repository = repository;
    this.cache = cache;
  }

  async createResume(userId: string, data: unknown): Promise<Resume> {
    // Validate the deeply nested JSON against Zod
    const parsedData = CreateResumeSchema.parse(data);

    // Persist to MongoDB
    const created = await this.repository.create(userId, parsedData);

    // Cache the newly created resume in Redis for frequent sub-millisecond retrieval
    await this.cache.cacheResume(created);

    return created;
  }

  async getResume(id: string, userId: string): Promise<Resume> {
    // 1. Check Redis cache first
    const cached = await this.cache.getCachedResume(id);
    if (cached) {
      // Ensure the resume belongs to the authenticated caller
      if (cached.userId !== userId) {
        throw new NotFoundError(`Resume with ID ${id}`);
      }
      return cached;
    }

    // 2. Cache miss -> query MongoDB
    const resume = await this.repository.findById(id);
    if (!resume || resume.userId !== userId) {
      throw new NotFoundError(`Resume with ID ${id}`);
    }

    // 3. Populate Redis cache for future calls
    await this.cache.cacheResume(resume);

    return resume;
  }

  async updateResumePdfUrl(
    id: string,
    userId: string,
    pdfUrl: string,
    fileKey?: string,
    jobId?: string
  ): Promise<Resume> {
    // Verify resume exists and belongs to user
    await this.getResume(id, userId);

    const updated = await this.repository.updatePdfUrl(id, pdfUrl, fileKey, jobId);
    if (!updated) {
      throw new NotFoundError(`Resume with ID ${id}`);
    }

    // Refresh Redis cache
    await this.cache.cacheResume(updated);
    return updated;
  }

  async getResumeForJob(userId: string, jobId: string): Promise<Resume | null> {
    // 1. Check Redis cache first
    const cached = await this.cache.getCachedResumeByJob(userId, jobId);
    if (cached) {
      return cached;
    }

    // 2. Cache miss -> query MongoDB
    const resume = await this.repository.findByJobId(userId, jobId);
    if (resume) {
      await this.cache.cacheResume(resume);
    }
    return resume;
  }

  async getUserResumes(userId: string): Promise<Resume[]> {
    // 1. Check Redis cache first
    const cachedList = await this.cache.getCachedUserResumes(userId);
    if (cachedList) {
      return cachedList;
    }

    // 2. Cache miss -> query MongoDB
    const resumes = await this.repository.findByUserId(userId);

    // 3. Populate Redis cache if results found
    if (resumes.length > 0) {
      await this.cache.cacheUserResumes(userId, resumes);
    }

    return resumes;
  }

  async getLatestResume(userId: string): Promise<Resume | null> {
    // 1. Check Redis cache for latest resume
    const cachedLatest = await this.cache.getCachedLatestResume(userId);
    if (cachedLatest) {
      return cachedLatest;
    }

    // 2. Cache miss -> retrieve all resumes and sort by creation timestamp
    const resumes = await this.getUserResumes(userId);
    if (resumes.length === 0) return null;

    const latest = resumes.sort(
      (a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)
    )[0];

    await this.cache.cacheLatestResume(userId, latest);
    return latest;
  }

  async searchSimilarResumes(
    userId: string,
    options: { queryVector?: number[]; query?: string; limit?: number } | number[],
    legacyLimit: number = 3
  ) {
    if (Array.isArray(options)) {
      if (options.length === 0) {
        throw new Error("Invalid query vector provided for semantic search.");
      }
      return await this.repository.findSimilarResumes(userId, options, legacyLimit);
    }

    const { queryVector, query, limit = 5 } = options;
    if (queryVector && queryVector.length > 0) {
      return await this.repository.findSimilarResumes(userId, queryVector, limit);
    }

    if (query && query.trim().length > 0) {
      return await this.repository.findResumesByQuery(userId, query.trim(), limit);
    }

    // Fallback: return candidate's existing resumes with baseline scores
    const resumes = await this.getUserResumes(userId);
    return resumes.slice(0, limit).map((r, i) => ({
      ...r,
      score: Math.max(0.6, 0.9 - i * 0.05),
    }));
  }
}

export const resumeService = new ResumeService();
