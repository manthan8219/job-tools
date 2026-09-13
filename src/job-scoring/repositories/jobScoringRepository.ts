import { queryPostgres } from "../../db/index.js";
import {
  JobUserScore,
  SaveJobUserScoreInput,
  JobUserScoreFilter,
  ScoredJobWithDetails,
} from "../models/jobScoring.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class JobScoringRepository {
  /**
   * Initializes the PostgreSQL job_user_scores table and indexes
   */
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS job_user_scores (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          resume_id VARCHAR(255),
          overall_score NUMERIC(5, 2) NOT NULL,
          fit_verdict VARCHAR(50) NOT NULL,
          hard_skills_score NUMERIC(5, 2),
          experience_score NUMERIC(5, 2),
          architecture_score NUMERIC(5, 2),
          domain_score NUMERIC(5, 2),
          ats_score NUMERIC(5, 2),
          score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
          strong_points JSONB NOT NULL DEFAULT '[]'::jsonb,
          weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
          missing_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
          keyword_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
          actionable_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_job_user_score UNIQUE (user_id, job_id)
        );

        CREATE INDEX IF NOT EXISTS idx_job_user_scores_user_score ON job_user_scores (user_id, overall_score DESC);
        CREATE INDEX IF NOT EXISTS idx_job_user_scores_job ON job_user_scores (job_id);
        CREATE INDEX IF NOT EXISTS idx_job_user_scores_verdict ON job_user_scores (user_id, fit_verdict);
      `);
      logger.info("[JobScoringRepository] Initialized job_user_scores table in PostgreSQL");
    } catch (error) {
      logger.error("[JobScoringRepository] Failed to initialize job_user_scores table", error);
      throw error;
    }
  }

  /**
   * Upserts a candidate match score for a specific user and job
   */
  async upsertScore(input: SaveJobUserScoreInput): Promise<JobUserScore> {
    const id = input.id || randomUUID();
    const breakdown = input.score_breakdown;
    const hardSkillsScore = breakdown?.hard_skills?.score ?? null;
    const experienceScore = breakdown?.experience_and_seniority?.score ?? null;
    const architectureScore = breakdown?.architecture_and_scale?.score ?? null;
    const domainScore = breakdown?.domain_and_industry?.score ?? null;
    const atsScore = breakdown?.ats_keyword_compatibility?.score ?? null;

    const sql = `
      INSERT INTO job_user_scores (
        id, user_id, job_id, resume_id, overall_score, fit_verdict,
        hard_skills_score, experience_score, architecture_score, domain_score, ats_score,
        score_breakdown, strong_points, weaknesses, missing_gaps,
        keyword_matrix, actionable_recommendations, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        resume_id = COALESCE(EXCLUDED.resume_id, job_user_scores.resume_id),
        overall_score = EXCLUDED.overall_score,
        fit_verdict = EXCLUDED.fit_verdict,
        hard_skills_score = EXCLUDED.hard_skills_score,
        experience_score = EXCLUDED.experience_score,
        architecture_score = EXCLUDED.architecture_score,
        domain_score = EXCLUDED.domain_score,
        ats_score = EXCLUDED.ats_score,
        score_breakdown = EXCLUDED.score_breakdown,
        strong_points = EXCLUDED.strong_points,
        weaknesses = EXCLUDED.weaknesses,
        missing_gaps = EXCLUDED.missing_gaps,
        keyword_matrix = EXCLUDED.keyword_matrix,
        actionable_recommendations = EXCLUDED.actionable_recommendations,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id, user_id AS "userId", job_id AS "jobId", resume_id AS "resumeId",
        overall_score AS "overallScore", fit_verdict AS "fitVerdict",
        hard_skills_score AS "hardSkillsScore", experience_score AS "experienceScore",
        architecture_score AS "architectureScore", domain_score AS "domainScore",
        ats_score AS "atsScore", score_breakdown AS "scoreBreakdown",
        strong_points AS "strongPoints", weaknesses,
        missing_gaps AS "missingGaps", keyword_matrix AS "keywordMatrix",
        actionable_recommendations AS "actionableRecommendations",
        created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const params = [
      id,
      input.userId,
      input.jobId,
      input.resumeId || null,
      input.overall_score,
      input.fit_verdict,
      hardSkillsScore,
      experienceScore,
      architectureScore,
      domainScore,
      atsScore,
      JSON.stringify(input.score_breakdown || {}),
      JSON.stringify(input.strong_points || []),
      JSON.stringify(input.weaknesses || []),
      JSON.stringify(input.missing_gaps || []),
      JSON.stringify(input.keyword_matrix || {}),
      JSON.stringify(input.actionable_recommendations || []),
    ];

    const res = await queryPostgres(sql, params);
    const row = res.rows[0];

    return {
      ...row,
      overallScore: Number(row.overallScore),
      hardSkillsScore: row.hardSkillsScore ? Number(row.hardSkillsScore) : undefined,
      experienceScore: row.experienceScore ? Number(row.experienceScore) : undefined,
      architectureScore: row.architectureScore ? Number(row.architectureScore) : undefined,
      domainScore: row.domainScore ? Number(row.domainScore) : undefined,
      atsScore: row.atsScore ? Number(row.atsScore) : undefined,
    };
  }

  /**
   * Retrieves score for a specific user and job
   */
  async findByUserAndJob(userId: string, jobId: string): Promise<JobUserScore | null> {
    const sql = `
      SELECT
        id, user_id AS "userId", job_id AS "jobId", resume_id AS "resumeId",
        overall_score AS "overallScore", fit_verdict AS "fitVerdict",
        hard_skills_score AS "hardSkillsScore", experience_score AS "experienceScore",
        architecture_score AS "architectureScore", domain_score AS "domainScore",
        ats_score AS "atsScore", score_breakdown AS "scoreBreakdown",
        strong_points AS "strongPoints", weaknesses,
        missing_gaps AS "missingGaps", keyword_matrix AS "keywordMatrix",
        actionable_recommendations AS "actionableRecommendations",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM job_user_scores
      WHERE user_id = $1 AND job_id = $2;
    `;

    const res = await queryPostgres(sql, [userId, jobId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      ...row,
      overallScore: Number(row.overallScore),
      hardSkillsScore: row.hardSkillsScore ? Number(row.hardSkillsScore) : undefined,
      experienceScore: row.experienceScore ? Number(row.experienceScore) : undefined,
      architectureScore: row.architectureScore ? Number(row.architectureScore) : undefined,
      domainScore: row.domainScore ? Number(row.domainScore) : undefined,
      atsScore: row.atsScore ? Number(row.atsScore) : undefined,
    };
  }

  /**
   * Lists a user's top scored jobs with full job and company metadata
   */
  async findUserTopScoredJobs(filter: JobUserScoreFilter): Promise<{ scores: ScoredJobWithDetails[]; totalFound: number }> {
    const conditions: string[] = ["s.user_id = $1"];
    const params: any[] = [filter.userId];
    let paramIndex = 2;

    if (filter.minScore !== undefined) {
      conditions.push(`s.overall_score >= $${paramIndex++}`);
      params.push(filter.minScore);
    }

    if (filter.fitVerdict) {
      conditions.push(`s.fit_verdict = $${paramIndex++}`);
      params.push(filter.fitVerdict);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `SELECT COUNT(*) AS count FROM job_user_scores s ${whereClause};`;
    const countRes = await queryPostgres(countSql, params);
    const totalFound = parseInt(countRes.rows[0].count, 10);

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const dataSql = `
      SELECT
        s.id, s.user_id AS "userId", s.job_id AS "jobId", s.resume_id AS "resumeId",
        s.overall_score AS "overallScore", s.fit_verdict AS "fitVerdict",
        s.hard_skills_score AS "hardSkillsScore", s.experience_score AS "experienceScore",
        s.architecture_score AS "architectureScore", s.domain_score AS "domainScore",
        s.ats_score AS "atsScore", s.score_breakdown AS "scoreBreakdown",
        s.strong_points AS "strongPoints", s.weaknesses,
        s.missing_gaps AS "missingGaps", s.keyword_matrix AS "keywordMatrix",
        s.actionable_recommendations AS "actionableRecommendations",
        s.created_at AS "createdAt", s.updated_at AS "updatedAt",
        j.title AS "jobTitle",
        COALESCE(c.name, j.company) AS "companyName",
        COALESCE(c.slug, j.company_slug) AS "companySlug",
        COALESCE(c.logo_url, j.company_logo_url) AS "companyLogoUrl",
        COALESCE(l.name, j.raw_location) AS "locationName",
        j.work_arrangement AS "workArrangement",
        j.employment_type AS "employmentType",
        j.apply_url AS "applyUrl",
        j.salary_min AS "salaryMin",
        j.salary_max AS "salaryMax",
        j.salary_currency AS "salaryCurrency"
      FROM job_user_scores s
      JOIN jobs j ON s.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN locations l ON j.primary_location_id = l.id
      ${whereClause}
      ORDER BY s.overall_score DESC, s.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataRes = await queryPostgres(dataSql, [...params, limit, offset]);

    return {
      scores: dataRes.rows.map((row: any) => ({
        ...row,
        overallScore: Number(row.overallScore),
        hardSkillsScore: row.hardSkillsScore ? Number(row.hardSkillsScore) : undefined,
        experienceScore: row.experienceScore ? Number(row.experienceScore) : undefined,
        architectureScore: row.architectureScore ? Number(row.architectureScore) : undefined,
        domainScore: row.domainScore ? Number(row.domainScore) : undefined,
        atsScore: row.atsScore ? Number(row.atsScore) : undefined,
        salaryMin: row.salaryMin ? Number(row.salaryMin) : undefined,
        salaryMax: row.salaryMax ? Number(row.salaryMax) : undefined,
      })),
      totalFound,
    };
  }

  /**
   * Deletes score for a user and job
   */
  async deleteScore(userId: string, jobId: string): Promise<boolean> {
    const res = await queryPostgres(
      `DELETE FROM job_user_scores WHERE user_id = $1 AND job_id = $2`,
      [userId, jobId]
    );
    return (res.rowCount || 0) > 0;
  }
}
