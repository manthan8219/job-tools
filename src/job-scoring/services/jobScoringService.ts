import { JobScoringRepository } from "../repositories/jobScoringRepository.js";
import {
  JobUserScore,
  SaveJobUserScoreInput,
  JobUserScoreFilter,
  ScoredJobWithDetails,
} from "../models/jobScoring.js";
import { logger } from "../../utils/index.js";

export class JobScoringService {
  constructor(private repo = new JobScoringRepository()) {}

  /**
   * Initializes the job scoring table
   */
  async init(): Promise<void> {
    await this.repo.init();
  }

  /**
   * Saves or updates candidate fit verdict and score analysis for a job
   */
  async saveScore(input: SaveJobUserScoreInput): Promise<JobUserScore> {
    const saved = await this.repo.upsertScore(input);
    logger.info(`[JobScoringService] Saved score for user ${input.userId} on job ${input.jobId}: ${input.overall_score}% (${input.fit_verdict})`);
    return saved;
  }

  /**
   * Retrieves match score and breakdown for a user and job
   */
  async getScore(userId: string, jobId: string): Promise<JobUserScore | null> {
    return await this.repo.findByUserAndJob(userId, jobId);
  }

  /**
   * Returns top matching jobs for a user sorted by fit score
   */
  async getUserTopScoredJobs(
    filter: JobUserScoreFilter
  ): Promise<{ scores: ScoredJobWithDetails[]; totalFound: number }> {
    return await this.repo.findUserTopScoredJobs(filter);
  }

  /**
   * Deletes a match score
   */
  async deleteScore(userId: string, jobId: string): Promise<boolean> {
    return await this.repo.deleteScore(userId, jobId);
  }
}
