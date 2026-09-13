import { queryPostgres } from "../../db/index.js";
import {
  Company,
  CreateCompanyInput,
  CompanyFilter,
  CompanyWithJobStats,
  INITIAL_COMPANIES_SEED,
} from "../models/company.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class CompanyRepository {
  /**
   * Initializes the companies table, foreign keys, and indexes
   */
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS companies (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) UNIQUE NOT NULL,
          website_url TEXT,
          logo_url TEXT,
          description TEXT,
          industry VARCHAR(100),
          size_range VARCHAR(50),
          headquarters_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
          ats_type VARCHAR(50),
          ats_board_token VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies (slug);
        CREATE INDEX IF NOT EXISTS idx_companies_ats ON companies (ats_type, is_active);
        CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);

        -- Add company_id reference to jobs if not present
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'jobs' AND column_name = 'company_id'
          ) THEN
            ALTER TABLE jobs ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
            CREATE INDEX idx_jobs_company_id ON jobs (company_id);
          END IF;
        END $$;
      `);
      logger.info("[CompanyRepository] Initialized companies table in PostgreSQL");
    } catch (error) {
      logger.error("[CompanyRepository] Failed to initialize companies table", error);
      throw error;
    }
  }

  /**
   * Seeds the initial canonical target companies if empty
   */
  async seedDefaultCompanies(): Promise<void> {
    try {
      const existing = await queryPostgres("SELECT COUNT(*) AS count FROM companies");
      if (parseInt(existing.rows[0].count, 10) > 0) {
        return;
      }

      logger.info("[CompanyRepository] Seeding default target companies into PostgreSQL...");

      for (const item of INITIAL_COMPANIES_SEED) {
        await this.createCompany(item);
      }

      logger.info(`[CompanyRepository] Seeded ${INITIAL_COMPANIES_SEED.length} default companies.`);
    } catch (error) {
      logger.error("[CompanyRepository] Error seeding default companies", error);
      throw error;
    }
  }

  /**
   * Creates a new company record
   */
  async createCompany(input: CreateCompanyInput): Promise<Company> {
    const id = input.id || randomUUID();
    const now = new Date();

    const sql = `
      INSERT INTO companies (
        id, name, slug, website_url, logo_url, description, industry,
        size_range, headquarters_location_id, ats_type, ats_board_token,
        is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        website_url = COALESCE(EXCLUDED.website_url, companies.website_url),
        logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url),
        description = COALESCE(EXCLUDED.description, companies.description),
        industry = COALESCE(EXCLUDED.industry, companies.industry),
        ats_type = COALESCE(EXCLUDED.ats_type, companies.ats_type),
        ats_board_token = COALESCE(EXCLUDED.ats_board_token, companies.ats_board_token),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id, name, slug, website_url AS "websiteUrl", logo_url AS "logoUrl",
        description, industry, size_range AS "sizeRange",
        headquarters_location_id AS "headquartersLocationId",
        ats_type AS "atsType", ats_board_token AS "atsBoardToken",
        is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const values = [
      id,
      input.name,
      input.slug.toLowerCase().trim(),
      input.websiteUrl || null,
      input.logoUrl || null,
      input.description || null,
      input.industry || null,
      input.sizeRange || null,
      input.headquartersLocationId || null,
      input.atsType || null,
      input.atsBoardToken || null,
      input.isActive ?? true,
      now,
      now,
    ];

    const res = await queryPostgres<Company>(sql, values);
    return res.rows[0];
  }

  /**
   * Looks up a company by slug or name, creating it on the fly if not found
   */
  async findOrCreateCompany(data: {
    name: string;
    slug?: string;
    websiteUrl?: string;
    logoUrl?: string;
    atsType?: any;
    atsBoardToken?: string;
  }): Promise<Company> {
    const slug = (data.slug || data.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

    const existing = await this.findBySlug(slug);
    if (existing) {
      return existing;
    }

    return await this.createCompany({
      name: data.name,
      slug,
      websiteUrl: data.websiteUrl,
      logoUrl: data.logoUrl,
      atsType: data.atsType,
      atsBoardToken: data.atsBoardToken,
      isActive: true,
    });
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const res = await queryPostgres<Company>(
      `SELECT
        id, name, slug, website_url AS "websiteUrl", logo_url AS "logoUrl",
        description, industry, size_range AS "sizeRange",
        headquarters_location_id AS "headquartersLocationId",
        ats_type AS "atsType", ats_board_token AS "atsBoardToken",
        is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM companies WHERE slug = $1`,
      [slug.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  }

  async findById(id: string): Promise<Company | null> {
    const res = await queryPostgres<Company>(
      `SELECT
        id, name, slug, website_url AS "websiteUrl", logo_url AS "logoUrl",
        description, industry, size_range AS "sizeRange",
        headquarters_location_id AS "headquartersLocationId",
        ats_type AS "atsType", ats_board_token AS "atsBoardToken",
        is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM companies WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Returns active target companies configured for a specific ATS platform (e.g. 'greenhouse')
   */
  async getActiveCompaniesByAts(atsType: string): Promise<Company[]> {
    const res = await queryPostgres<Company>(
      `SELECT
        id, name, slug, website_url AS "websiteUrl", logo_url AS "logoUrl",
        description, industry, size_range AS "sizeRange",
        headquarters_location_id AS "headquartersLocationId",
        ats_type AS "atsType", ats_board_token AS "atsBoardToken",
        is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM companies
       WHERE ats_type = $1 AND is_active = true
       ORDER BY name ASC`,
      [atsType.toLowerCase()]
    );
    return res.rows;
  }

  /**
   * Search and filter companies with active jobs count
   */
  async listCompanies(filter: CompanyFilter = {}): Promise<{ companies: CompanyWithJobStats[]; totalFound: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.isActive !== undefined) {
      conditions.push(`c.is_active = $${paramIndex++}`);
      params.push(filter.isActive);
    }

    if (filter.query) {
      conditions.push(`(
        LOWER(c.name) LIKE $${paramIndex} OR
        LOWER(c.slug) LIKE $${paramIndex} OR
        LOWER(COALESCE(c.industry, '')) LIKE $${paramIndex}
      )`);
      params.push(`%${filter.query.toLowerCase().trim()}%`);
      paramIndex++;
    }

    if (filter.industry) {
      conditions.push(`LOWER(c.industry) = LOWER($${paramIndex++})`);
      params.push(filter.industry);
    }

    if (filter.atsType) {
      conditions.push(`c.ats_type = $${paramIndex++}`);
      params.push(filter.atsType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS count FROM companies c ${whereClause};`;
    const countRes = await queryPostgres(countSql, params);
    const totalFound = parseInt(countRes.rows[0].count, 10);

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const dataSql = `
      SELECT
        c.id, c.name, c.slug, c.website_url AS "websiteUrl", c.logo_url AS "logoUrl",
        c.description, c.industry, c.size_range AS "sizeRange",
        c.headquarters_location_id AS "headquartersLocationId",
        c.ats_type AS "atsType", c.ats_board_token AS "atsBoardToken",
        c.is_active AS "isActive", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        COUNT(j.id) FILTER (WHERE j.status = 'active') AS "activeJobsCount"
      FROM companies c
      LEFT JOIN jobs j ON j.company_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY "activeJobsCount" DESC, c.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataRes = await queryPostgres(dataSql, [...params, limit, offset]);

    return {
      companies: dataRes.rows.map((row: any) => ({
        ...row,
        activeJobsCount: parseInt(row.activeJobsCount, 10) || 0,
      })),
      totalFound,
    };
  }
}
