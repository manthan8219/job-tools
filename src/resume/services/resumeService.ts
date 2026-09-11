import { resumeRepository } from "../repositories/resumeRepository.js";
import { CreateResumeSchema, type Resume } from "../models/resume.js";
import { NotFoundError } from "../../utils/index.js";

export class ResumeService {
  async createResume(userId: string, data: unknown): Promise<Resume> {
    // Validate the deeply nested JSON against Zod
    const parsedData = CreateResumeSchema.parse(data);

    // Persist to MongoDB
    return await resumeRepository.create(userId, parsedData);
  }

  async getResume(id: string, userId: string): Promise<Resume> {
    const resume = await resumeRepository.findById(id);
    
    // Ensure the resume exists and belongs to the caller
    if (!resume || resume.userId !== userId) {
      throw new NotFoundError(`Resume with ID ${id}`);
    }
    
    return resume;
  }

  async getUserResumes(userId: string): Promise<Resume[]> {
    return await resumeRepository.findByUserId(userId);
  }

  async searchSimilarResumes(userId: string, queryVector: number[], limit: number = 3) {
    if (!queryVector || queryVector.length === 0) {
      throw new Error("Invalid query vector provided for semantic search.");
    }
    return await resumeRepository.findSimilarResumes(userId, queryVector, limit);
  }
}

export const resumeService = new ResumeService();
