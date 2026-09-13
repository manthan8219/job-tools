import { queryPostgres } from "../../db/index.js";
import { Job, CreateJobInput, JobFilter, JobSearchResult } from "../models/job.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class JobRepository {
  /**
   * Initializes the global jobs table, multi-location junction, and indexes
   */
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS jobs (
          id UUID PRIMARY KEY,
          job_key VARCHAR(64) UNIQUE NOT NULL,
          external_id VARCHAR(255) NOT NULL,
          source VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          company VARCHAR(255) NOT NULL,
          company_slug VARCHAR(255),
          company_logo_url TEXT,
          description TEXT,
          excerpt TEXT,
          apply_url TEXT NOT NULL,
          apply_type VARCHAR(30) DEFAULT 'url',
          apply_email VARCHAR(255),
          employment_type VARCHAR(30) DEFAULT 'unknown',
          work_arrangement VARCHAR(30) DEFAULT 'unknown',
          experience_level VARCHAR(30) DEFAULT 'unknown',
          categories TEXT[] DEFAULT '{}',
          skills TEXT[] DEFAULT '{}',
          salary_min NUMERIC(12, 2),
          salary_max NUMERIC(12, 2),
          salary_currency VARCHAR(10) DEFAULT 'USD',
          salary_period VARCHAR(20) DEFAULT 'annual',
          primary_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
          company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
          raw_location VARCHAR(255),
          is_worldwide BOOLEAN DEFAULT false,
          status VARCHAR(30) DEFAULT 'active',
          posted_at TIMESTAMP WITH TIME ZONE,
          last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS job_locations (
          id UUID PRIMARY KEY,
          job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_job_location_link UNIQUE (job_id, location_id)
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs (primary_location_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_status_arrangement ON jobs (status, work_arrangement);
        CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);
        CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs (company);
        CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs USING GIN (skills);
        CREATE INDEX IF NOT EXISTS idx_jobs_categories ON jobs USING GIN (categories);

        -- Ensure company_id exists if jobs table pre-dated companies migration
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'jobs' AND column_name = 'company_id'
          ) THEN
            ALTER TABLE jobs ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs (company_id);
      `);
      logger.info("[JobRepository] Initialized jobs and job_locations tables in PostgreSQL");
    } catch (error) {
      logger.error("[JobRepository] Failed to initialize jobs tables", error);
      throw error;
    }
  }

  /**
   * Inserts a new job or updates an existing job using its deterministic jobKey
   */
  async upsertJob(data: CreateJobInput): Promise<Job> {
    const id = data.id || randomUUID();
    const now = new Date();

    const sql = `
      INSERT INTO jobs (
        id, job_key, external_id, source, title, company, company_slug, company_logo_url,
        description, excerpt, apply_url, apply_type, apply_email, employment_type,
        work_arrangement, experience_level, categories, skills, salary_min, salary_max,
        salary_currency, salary_period, primary_location_id, company_id, raw_location, is_worldwide,
        status, posted_at, last_seen_at, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32
      )
      ON CONFLICT (job_key) DO UPDATE SET
        title = EXCLUDED.title,
        description = COALESCE(EXCLUDED.description, jobs.description),
        excerpt = COALESCE(EXCLUDED.excerpt, jobs.excerpt),
        apply_url = EXCLUDED.apply_url,
        salary_min = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
        salary_max = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
        primary_location_id = COALESCE(EXCLUDED.primary_location_id, jobs.primary_location_id),
        company_id = COALESCE(EXCLUDED.company_id, jobs.company_id),
        status = 'active',
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id, job_key AS "jobKey", external_id AS "externalId", source, title, company,
        company_slug AS "companySlug", company_logo_url AS "companyLogoUrl",
        description, excerpt, apply_url AS "applyUrl", apply_type AS "applyType",
        apply_email AS "applyEmail", employment_type AS "employmentType",
        work_arrangement AS "workArrangement", experience_level AS "experienceLevel",
        categories, skills, salary_min AS "salaryMin", salary_max AS "salaryMax",
        salary_currency AS "salaryCurrency", salary_period AS "salaryPeriod",
        primary_location_id AS "primaryLocationId", company_id AS "companyId", raw_location AS "rawLocation",
        is_worldwide AS "isWorldwide", status, posted_at AS "postedAt",
        last_seen_at AS "lastSeenAt", expires_at AS "expiresAt",
        created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const values = [
      id,
      data.jobKey,
      data.externalId,
      data.source,
      data.title,
      data.company,
      data.companySlug || null,
      data.companyLogoUrl || null,
      data.description || null,
      data.excerpt || null,
      data.applyUrl,
      data.applyType || "url",
      data.applyEmail || null,
      data.employmentType || "unknown",
      data.workArrangement || "unknown",
      data.experienceLevel || "unknown",
      data.categories || [],
      data.skills || [],
      data.salaryMin ?? null,
      data.salaryMax ?? null,
      data.salaryCurrency || "USD",
      data.salaryPeriod || "annual",
      data.primaryLocationId || null,
      data.companyId || null,
      data.rawLocation || null,
      data.isWorldwide || false,
      data.status || "active",
      data.postedAt || null,
      data.lastSeenAt || now,
      data.expiresAt || null,
      now,
      now,
    ];

    const result = await queryPostgres<Job>(sql, values);
    return result.rows[0];
  }

  /**
   * Search jobs with hierarchical location matching, filters, and pagination
   */
  async findJobs(filters: JobFilter): Promise<JobSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Status filter (default active)
    const status = filters.status || "active";
    conditions.push(`j.status = $${paramIndex++}`);
    params.push(status);

    // Free-text search across title, company, skills
    if (filters.query) {
      const q = `%${filters.query.toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(j.title) LIKE $${paramIndex} OR
        LOWER(j.company) LIKE $${paramIndex} OR
        $${paramIndex + 1} = ANY(j.skills)
      )`);
      params.push(q);
      params.push(filters.query.toLowerCase().trim());
      paramIndex += 2;
    }

    // Company filters
    if (filters.companySlug) {
      conditions.push(`(j.company_slug = $${paramIndex} OR LOWER(j.company) = $${paramIndex})`);
      params.push(filters.companySlug.toLowerCase().trim());
      paramIndex++;
    }

    if (filters.companyId) {
      conditions.push(`j.company_id = $${paramIndex++}`);
      params.push(filters.companyId);
    }

    // Work arrangement filter (remote, hybrid, on-site)
    if (filters.workArrangement) {
      conditions.push(`j.work_arrangement = $${paramIndex++}`);
      params.push(filters.workArrangement);
    }

    // Employment type filter
    if (filters.employmentType) {
      conditions.push(`j.employment_type = $${paramIndex++}`);
      params.push(filters.employmentType);
    }

    // Experience level filter
    if (filters.experienceLevel) {
      conditions.push(`j.experience_level = $${paramIndex++}`);
      params.push(filters.experienceLevel);
    }

    // Source filter
    if (filters.source) {
      conditions.push(`j.source = $${paramIndex++}`);
      params.push(filters.source);
    }

    // Skills match (array overlap)
    if (filters.skills && filters.skills.length > 0) {
      conditions.push(`j.skills && $${paramIndex++}`);
      params.push(filters.skills);
    }

    // Salary filter
    if (filters.salaryMin !== undefined) {
      conditions.push(`(j.salary_max IS NULL OR j.salary_max >= $${paramIndex++})`);
      params.push(filters.salaryMin);
    }

    // Location tree filtering
    // 1. Country code: Matches any location path starting with country code or worldwide
    if (filters.countryCode) {
      const cleanCode = filters.countryCode.toLowerCase().trim();
      conditions.push(`(
        l.path ILIKE $${paramIndex} OR
        l.code ILIKE $${paramIndex + 1} OR
        j.is_worldwide = true
      )`);
      params.push(`%.${cleanCode}%`);
      params.push(cleanCode);
      paramIndex += 2;
    }

    // 2. City slug: Matches specific city node
    if (filters.citySlug) {
      conditions.push(`l.slug = $${paramIndex++}`);
      params.push(filters.citySlug.toLowerCase().trim());
    }

    // 3. Exact path prefix: e.g. "world.europe.de"
    if (filters.locationPathPrefix) {
      conditions.push(`(l.path LIKE $${paramIndex++} || '%' OR j.is_worldwide = true)`);
      params.push(filters.locationPathPrefix);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS count
      FROM jobs j
      LEFT JOIN locations l ON j.primary_location_id = l.id
      ${whereClause};
    `;
    const countRes = await queryPostgres(countSql, params);
    const totalFound = parseInt(countRes.rows[0].count, 10);

    // Results query
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const dataSql = `
      SELECT
        j.id, j.job_key AS "jobKey", j.company_id AS "companyId", j.external_id AS "externalId", j.source, j.title,
        COALESCE(c.name, j.company) AS "company",
        COALESCE(c.slug, j.company_slug) AS "companySlug",
        COALESCE(c.logo_url, j.company_logo_url) AS "companyLogoUrl",
        c.website_url AS "companyWebsiteUrl",
        j.description, j.excerpt, j.apply_url AS "applyUrl", j.apply_type AS "applyType",
        j.apply_email AS "applyEmail", j.employment_type AS "employmentType",
        j.work_arrangement AS "workArrangement", j.experience_level AS "experienceLevel",
        j.categories, j.skills, j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
        j.salary_currency AS "salaryCurrency", j.salary_period AS "salaryPeriod",
        j.primary_location_id AS "primaryLocationId", j.raw_location AS "rawLocation",
        j.is_worldwide AS "isWorldwide", j.status, j.posted_at AS "postedAt",
        j.last_seen_at AS "lastSeenAt", j.expires_at AS "expiresAt",
        j.created_at AS "createdAt", j.updated_at AS "updatedAt",
        l.name AS "locationName", l.path AS "locationPath", l.code AS "countryCode"
      FROM jobs j
      LEFT JOIN locations l ON j.primary_location_id = l.id
      LEFT JOIN companies c ON j.company_id = c.id
      ${whereClause}
      ORDER BY j.posted_at DESC NULLS LAST, j.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataParams = [...params, limit, offset];
    const result = await queryPostgres(dataSql, dataParams);

    return {
      jobs: result.rows,
      totalFound,
      limit,
      offset,
    };
  }

  async findById(id: string): Promise<Job | null> {
    const res = await queryPostgres<Job>(
      `SELECT
        j.id, j.job_key AS "jobKey", j.company_id AS "companyId", j.external_id AS "externalId", j.source, j.title,
        COALESCE(c.name, j.company) AS "company",
        COALESCE(c.slug, j.company_slug) AS "companySlug",
        COALESCE(c.logo_url, j.company_logo_url) AS "companyLogoUrl",
        c.website_url AS "companyWebsiteUrl",
        j.description, j.excerpt, j.apply_url AS "applyUrl", j.apply_type AS "applyType",
        j.apply_email AS "applyEmail", j.employment_type AS "employmentType",
        j.work_arrangement AS "workArrangement", j.experience_level AS "experienceLevel",
        j.categories, j.skills, j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
        j.salary_currency AS "salaryCurrency", j.salary_period AS "salaryPeriod",
        j.primary_location_id AS "primaryLocationId", j.raw_location AS "rawLocation",
        j.is_worldwide AS "isWorldwide", j.status, j.posted_at AS "postedAt",
        j.last_seen_at AS "lastSeenAt", j.expires_at AS "expiresAt",
        j.created_at AS "createdAt", j.updated_at AS "updatedAt"
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByJobKey(jobKey: string): Promise<Job | null> {
    const res = await queryPostgres<Job>(
      `SELECT
        j.id, j.job_key AS "jobKey", j.company_id AS "companyId", j.external_id AS "externalId", j.source, j.title,
        COALESCE(c.name, j.company) AS "company",
        COALESCE(c.slug, j.company_slug) AS "companySlug",
        COALESCE(c.logo_url, j.company_logo_url) AS "companyLogoUrl",
        c.website_url AS "companyWebsiteUrl",
        j.description, j.excerpt, j.apply_url AS "applyUrl", j.apply_type AS "applyType",
        j.apply_email AS "applyEmail", j.employment_type AS "employmentType",
        j.work_arrangement AS "workArrangement", j.experience_level AS "experienceLevel",
        j.categories, j.skills, j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
        j.salary_currency AS "salaryCurrency", j.salary_period AS "salaryPeriod",
        j.primary_location_id AS "primaryLocationId", j.raw_location AS "rawLocation",
        j.is_worldwide AS "isWorldwide", j.status, j.posted_at AS "postedAt",
        j.last_seen_at AS "lastSeenAt", j.expires_at AS "expiresAt",
        j.created_at AS "createdAt", j.updated_at AS "updatedAt"
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.job_key = $1`,
      [jobKey]
    );
    return res.rows[0] || null;
  }

  async markExpired(externalId: string, source: string): Promise<void> {
    await queryPostgres(
      `UPDATE jobs SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE external_id = $1 AND source = $2`,
      [externalId, source]
    );
  }
}
