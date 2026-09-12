import { queryPostgres } from "../../db/index.js";
import { UserJobProfile } from "../models/jobProfile.js";
import { logger } from "../../utils/index.js";

export class JobProfileRepository {
  async initTables() {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS user_job_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID UNIQUE NOT NULL,
          target_titles TEXT[] NOT NULL,
          locations TEXT[] NOT NULL,
          experience_years INT NOT NULL,
          work_arrangements TEXT[] DEFAULT '{"remote", "hybrid", "on-site"}',
          employment_types TEXT[] DEFAULT '{"full-time"}',
          expected_salary_min INT,
          expected_salary_currency VARCHAR(10) DEFAULT 'USD',
          requires_sponsorship BOOLEAN DEFAULT FALSE,
          availability VARCHAR(255),
          must_have_skills TEXT[] DEFAULT '{}',
          target_industries TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          updated_by VARCHAR(255),
          deleted_at TIMESTAMP,
          deleted_by VARCHAR(255)
        )
      `);
      logger.info("user_job_profiles table initialized");
    } catch (error) {
      logger.error("Failed to initialize user_job_profiles table", error);
    }
  }

  async getProfile(userId: string): Promise<UserJobProfile | null> {
    const result = await queryPostgres(
      `SELECT * FROM user_job_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      targetTitles: row.target_titles,
      locations: row.locations,
      experienceYears: row.experience_years,
      workArrangements: row.work_arrangements,
      employmentTypes: row.employment_types,
      expectedSalaryMin: row.expected_salary_min,
      expectedSalaryCurrency: row.expected_salary_currency,
      requiresSponsorship: row.requires_sponsorship,
      availability: row.availability,
      mustHaveSkills: row.must_have_skills,
      targetIndustries: row.target_industries,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      deletedBy: row.deleted_by
    };
  }

  async upsertProfile(profile: UserJobProfile): Promise<UserJobProfile> {
    const now = new Date();
    
    await queryPostgres(
      `INSERT INTO user_job_profiles (
        user_id, target_titles, locations, experience_years, work_arrangements, 
        employment_types, expected_salary_min, expected_salary_currency, 
        requires_sponsorship, availability, must_have_skills, target_industries, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) ON CONFLICT (user_id) DO UPDATE SET
        target_titles = EXCLUDED.target_titles,
        locations = EXCLUDED.locations,
        experience_years = EXCLUDED.experience_years,
        work_arrangements = EXCLUDED.work_arrangements,
        employment_types = EXCLUDED.employment_types,
        expected_salary_min = EXCLUDED.expected_salary_min,
        expected_salary_currency = EXCLUDED.expected_salary_currency,
        requires_sponsorship = EXCLUDED.requires_sponsorship,
        availability = EXCLUDED.availability,
        must_have_skills = EXCLUDED.must_have_skills,
        target_industries = EXCLUDED.target_industries,
        updated_at = EXCLUDED.updated_at
      `,
      [
        profile.userId,
        profile.targetTitles,
        profile.locations,
        profile.experienceYears,
        profile.workArrangements,
        profile.employmentTypes,
        profile.expectedSalaryMin || null,
        profile.expectedSalaryCurrency,
        profile.requiresSponsorship,
        profile.availability || null,
        profile.mustHaveSkills,
        profile.targetIndustries,
        now
      ]
    );

    return (await this.getProfile(profile.userId)) as UserJobProfile;
  }
}

export const jobProfileRepository = new JobProfileRepository();
