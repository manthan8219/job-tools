import { queryPostgres } from "../../db/index.js";
import {
  UserWorkRepository,
  SaveUserWorkInput,
  UserWorkFilter,
} from "../models/userWork.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class UserWorkPostgresRepository {
  /**
   * Initializes the PostgreSQL user_repositories table and indexes
   */
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS user_repositories (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          repository_name VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          remote_url TEXT,
          local_path TEXT,
          primary_branch VARCHAR(100) DEFAULT 'main',
          tier VARCHAR(30) DEFAULT 'contributing',
          is_featured BOOLEAN DEFAULT FALSE,
          display_order INTEGER DEFAULT 0,
          is_fork BOOLEAN DEFAULT FALSE,
          is_private BOOLEAN DEFAULT FALSE,
          stars_count INTEGER DEFAULT 0,
          forks_count INTEGER DEFAULT 0,
          primary_language VARCHAR(100),
          primary_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
          technologies_detected JSONB NOT NULL DEFAULT '{}'::jsonb,
          first_commit_date TIMESTAMP WITH TIME ZONE,
          latest_commit_date TIMESTAMP WITH TIME ZONE,
          total_active_days INTEGER DEFAULT 0,
          total_commits INTEGER DEFAULT 0,
          lines_added INTEGER DEFAULT 0,
          lines_deleted INTEGER DEFAULT 0,
          files_modified INTEGER DEFAULT 0,
          timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
          commits_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
          system_overview TEXT,
          role_and_ownership TEXT,
          technical_challenges_solved TEXT,
          work_description JSONB NOT NULL DEFAULT '{}'::jsonb,
          bullet_points JSONB NOT NULL DEFAULT '[]'::jsonb,
          most_effective_work_list JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_user_repository UNIQUE (user_id, repository_name)
        );

        CREATE INDEX IF NOT EXISTS idx_user_repos_user_id ON user_repositories (user_id);
        CREATE INDEX IF NOT EXISTS idx_user_repos_user_featured ON user_repositories (user_id, is_featured, display_order);
        CREATE INDEX IF NOT EXISTS idx_user_repos_tier ON user_repositories (user_id, tier);
        CREATE INDEX IF NOT EXISTS idx_user_repos_primary_lang ON user_repositories (user_id, primary_language);
      `);
      logger.info("[UserWorkRepository] Initialized user_repositories table in PostgreSQL");
    } catch (error) {
      logger.error("[UserWorkRepository] Failed to initialize user_repositories table", error);
      throw error;
    }
  }

  /**
   * Helper to map row column names from database to camelCase UserWorkRepository object
   */
  private mapRow(row: any): UserWorkRepository {
    return {
      id: row.id,
      userId: row.userId || row.user_id,
      repositoryName: row.repositoryName || row.repository_name,
      fullName: row.fullName || row.full_name,
      remoteUrl: row.remoteUrl || row.remote_url,
      localPath: row.localPath || row.local_path,
      primaryBranch: row.primaryBranch || row.primary_branch || "main",
      tier: row.tier || "contributing",
      isFeatured: Boolean(row.isFeatured ?? row.is_featured),
      displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
      isFork: Boolean(row.isFork ?? row.is_fork),
      isPrivate: Boolean(row.isPrivate ?? row.is_private),
      starsCount: Number(row.starsCount ?? row.stars_count ?? 0),
      forksCount: Number(row.forksCount ?? row.forks_count ?? 0),
      primaryLanguage: row.primaryLanguage || row.primary_language,
      primaryLanguages: Array.isArray(row.primaryLanguages || row.primary_languages)
        ? row.primaryLanguages || row.primary_languages
        : [],
      technologiesDetected: row.technologiesDetected || row.technologies_detected || {},
      firstCommitDate: (row.firstCommitDate || row.first_commit_date)
        ? new Date(row.firstCommitDate || row.first_commit_date)
        : null,
      latestCommitDate: (row.latestCommitDate || row.latest_commit_date)
        ? new Date(row.latestCommitDate || row.latest_commit_date)
        : null,
      totalActiveDays: Number(row.totalActiveDays ?? row.total_active_days ?? 0),
      totalCommits: Number(row.totalCommits ?? row.total_commits ?? 0),
      linesAdded: Number(row.linesAdded ?? row.lines_added ?? 0),
      linesDeleted: Number(row.linesDeleted ?? row.lines_deleted ?? 0),
      filesModified: Number(row.filesModified ?? row.files_modified ?? 0),
      timeline: row.timeline || {},
      commitsSummary: row.commitsSummary || row.commits_summary || {},
      workDescription: row.workDescription || row.work_description || {
        system_overview: row.system_overview,
        role_and_ownership: row.role_and_ownership,
        technical_challenges_solved: row.technical_challenges_solved,
      },
      bulletPoints: Array.isArray(row.bulletPoints || row.bullet_points)
        ? row.bulletPoints || row.bullet_points
        : [],
      mostEffectiveWorkList: Array.isArray(row.mostEffectiveWorkList || row.most_effective_work_list)
        ? row.mostEffectiveWorkList || row.most_effective_work_list
        : [],
      createdAt: row.createdAt || row.created_at ? new Date(row.createdAt || row.created_at) : undefined,
      updatedAt: row.updatedAt || row.updated_at ? new Date(row.updatedAt || row.updated_at) : undefined,
    };
  }

  /**
   * Saves or updates a user repository and work extraction record
   */
  async upsert(input: SaveUserWorkInput): Promise<UserWorkRepository> {
    const id = input.id || randomUUID();
    const systemOverview = input.workDescription?.system_overview || null;
    const roleAndOwnership = input.workDescription?.role_and_ownership || null;
    const technicalChallenges = input.workDescription?.technical_challenges_solved || null;

    const sql = `
      INSERT INTO user_repositories (
        id, user_id, repository_name, full_name, remote_url, local_path,
        primary_branch, tier, is_featured, display_order, is_fork, is_private,
        stars_count, forks_count, primary_language, primary_languages, technologies_detected,
        first_commit_date, latest_commit_date, total_active_days,
        total_commits, lines_added, lines_deleted, files_modified,
        timeline, commits_summary,
        system_overview, role_and_ownership, technical_challenges_solved,
        work_description, bullet_points, most_effective_work_list,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26,
        $27, $28, $29,
        $30, $31, $32,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, repository_name) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, user_repositories.full_name),
        remote_url = COALESCE(EXCLUDED.remote_url, user_repositories.remote_url),
        local_path = COALESCE(EXCLUDED.local_path, user_repositories.local_path),
        primary_branch = COALESCE(EXCLUDED.primary_branch, user_repositories.primary_branch),
        tier = EXCLUDED.tier,
        is_featured = EXCLUDED.is_featured,
        display_order = EXCLUDED.display_order,
        is_fork = EXCLUDED.is_fork,
        is_private = EXCLUDED.is_private,
        stars_count = EXCLUDED.stars_count,
        forks_count = EXCLUDED.forks_count,
        primary_language = COALESCE(EXCLUDED.primary_language, user_repositories.primary_language),
        primary_languages = EXCLUDED.primary_languages,
        technologies_detected = EXCLUDED.technologies_detected,
        first_commit_date = COALESCE(EXCLUDED.first_commit_date, user_repositories.first_commit_date),
        latest_commit_date = COALESCE(EXCLUDED.latest_commit_date, user_repositories.latest_commit_date),
        total_active_days = EXCLUDED.total_active_days,
        total_commits = EXCLUDED.total_commits,
        lines_added = EXCLUDED.lines_added,
        lines_deleted = EXCLUDED.lines_deleted,
        files_modified = EXCLUDED.files_modified,
        timeline = EXCLUDED.timeline,
        commits_summary = EXCLUDED.commits_summary,
        system_overview = COALESCE(EXCLUDED.system_overview, user_repositories.system_overview),
        role_and_ownership = COALESCE(EXCLUDED.role_and_ownership, user_repositories.role_and_ownership),
        technical_challenges_solved = COALESCE(EXCLUDED.technical_challenges_solved, user_repositories.technical_challenges_solved),
        work_description = EXCLUDED.work_description,
        bullet_points = EXCLUDED.bullet_points,
        most_effective_work_list = EXCLUDED.most_effective_work_list,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id, user_id AS "userId", repository_name AS "repositoryName", full_name AS "fullName",
        remote_url AS "remoteUrl", local_path AS "localPath", primary_branch AS "primaryBranch",
        tier, is_featured AS "isFeatured", display_order AS "displayOrder",
        is_fork AS "isFork", is_private AS "isPrivate", stars_count AS "starsCount",
        forks_count AS "forksCount", primary_language AS "primaryLanguage",
        primary_languages AS "primaryLanguages", technologies_detected AS "technologiesDetected",
        first_commit_date AS "firstCommitDate", latest_commit_date AS "latestCommitDate",
        total_active_days AS "totalActiveDays", total_commits AS "totalCommits",
        lines_added AS "linesAdded", lines_deleted AS "linesDeleted", files_modified AS "filesModified",
        timeline, commits_summary AS "commitsSummary",
        system_overview AS "systemOverview", role_and_ownership AS "roleAndOwnership",
        technical_challenges_solved AS "technicalChallengesSolved",
        work_description AS "workDescription", bullet_points AS "bulletPoints",
        most_effective_work_list AS "mostEffectiveWorkList",
        created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const params = [
      id,
      input.userId,
      input.repositoryName,
      input.fullName || null,
      input.remoteUrl || null,
      input.localPath || null,
      input.primaryBranch || "main",
      input.tier || "contributing",
      input.isFeatured ?? false,
      input.displayOrder ?? 0,
      input.isFork ?? false,
      input.isPrivate ?? false,
      input.starsCount ?? 0,
      input.forksCount ?? 0,
      input.primaryLanguage || null,
      JSON.stringify(input.primaryLanguages || []),
      JSON.stringify(input.technologiesDetected || {}),
      input.firstCommitDate || null,
      input.latestCommitDate || null,
      input.totalActiveDays ?? 0,
      input.totalCommits ?? 0,
      input.linesAdded ?? 0,
      input.linesDeleted ?? 0,
      input.filesModified ?? 0,
      JSON.stringify(input.timeline || {}),
      JSON.stringify(input.commitsSummary || {}),
      systemOverview,
      roleAndOwnership,
      technicalChallenges,
      JSON.stringify(input.workDescription || {}),
      JSON.stringify(input.bulletPoints || []),
      JSON.stringify(input.mostEffectiveWorkList || []),
    ];

    const res = await queryPostgres(sql, params);
    return this.mapRow(res.rows[0]);
  }

  /**
   * Retrieves a repository work record by ID
   */
  async findById(id: string): Promise<UserWorkRepository | null> {
    const sql = `
      SELECT
        id, user_id AS "userId", repository_name AS "repositoryName", full_name AS "fullName",
        remote_url AS "remoteUrl", local_path AS "localPath", primary_branch AS "primaryBranch",
        tier, is_featured AS "isFeatured", display_order AS "displayOrder",
        is_fork AS "isFork", is_private AS "isPrivate", stars_count AS "starsCount",
        forks_count AS "forksCount", primary_language AS "primaryLanguage",
        primary_languages AS "primaryLanguages", technologies_detected AS "technologiesDetected",
        first_commit_date AS "firstCommitDate", latest_commit_date AS "latestCommitDate",
        total_active_days AS "totalActiveDays", total_commits AS "totalCommits",
        lines_added AS "linesAdded", lines_deleted AS "linesDeleted", files_modified AS "filesModified",
        timeline, commits_summary AS "commitsSummary",
        system_overview AS "systemOverview", role_and_ownership AS "roleAndOwnership",
        technical_challenges_solved AS "technicalChallengesSolved",
        work_description AS "workDescription", bullet_points AS "bulletPoints",
        most_effective_work_list AS "mostEffectiveWorkList",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_repositories
      WHERE id = $1;
    `;

    const res = await queryPostgres(sql, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  /**
   * Retrieves a repository work record by user ID and repository name
   */
  async findByUserAndRepo(userId: string, repositoryName: string): Promise<UserWorkRepository | null> {
    const sql = `
      SELECT
        id, user_id AS "userId", repository_name AS "repositoryName", full_name AS "fullName",
        remote_url AS "remoteUrl", local_path AS "localPath", primary_branch AS "primaryBranch",
        tier, is_featured AS "isFeatured", display_order AS "displayOrder",
        is_fork AS "isFork", is_private AS "isPrivate", stars_count AS "starsCount",
        forks_count AS "forksCount", primary_language AS "primaryLanguage",
        primary_languages AS "primaryLanguages", technologies_detected AS "technologiesDetected",
        first_commit_date AS "firstCommitDate", latest_commit_date AS "latestCommitDate",
        total_active_days AS "totalActiveDays", total_commits AS "totalCommits",
        lines_added AS "linesAdded", lines_deleted AS "linesDeleted", files_modified AS "filesModified",
        timeline, commits_summary AS "commitsSummary",
        system_overview AS "systemOverview", role_and_ownership AS "roleAndOwnership",
        technical_challenges_solved AS "technicalChallengesSolved",
        work_description AS "workDescription", bullet_points AS "bulletPoints",
        most_effective_work_list AS "mostEffectiveWorkList",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_repositories
      WHERE user_id = $1 AND repository_name = $2;
    `;

    const res = await queryPostgres(sql, [userId, repositoryName]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  /**
   * Lists repositories for a user with filtering and pagination
   */
  async findByUserId(filter: UserWorkFilter): Promise<{ repositories: UserWorkRepository[]; totalFound: number }> {
    const conditions: string[] = ["user_id = $1"];
    const params: any[] = [filter.userId];
    let paramIndex = 2;

    if (filter.tier) {
      conditions.push(`tier = $${paramIndex++}`);
      params.push(filter.tier);
    }

    if (filter.isFeatured !== undefined) {
      conditions.push(`is_featured = $${paramIndex++}`);
      params.push(filter.isFeatured);
    }

    if (filter.primaryLanguage) {
      conditions.push(`LOWER(primary_language) = LOWER($${paramIndex++})`);
      params.push(filter.primaryLanguage);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `SELECT COUNT(*) AS count FROM user_repositories ${whereClause};`;
    const countRes = await queryPostgres(countSql, params);
    const totalFound = parseInt(countRes.rows[0].count, 10);

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const dataSql = `
      SELECT
        id, user_id AS "userId", repository_name AS "repositoryName", full_name AS "fullName",
        remote_url AS "remoteUrl", local_path AS "localPath", primary_branch AS "primaryBranch",
        tier, is_featured AS "isFeatured", display_order AS "displayOrder",
        is_fork AS "isFork", is_private AS "isPrivate", stars_count AS "starsCount",
        forks_count AS "forksCount", primary_language AS "primaryLanguage",
        primary_languages AS "primaryLanguages", technologies_detected AS "technologiesDetected",
        first_commit_date AS "firstCommitDate", latest_commit_date AS "latestCommitDate",
        total_active_days AS "totalActiveDays", total_commits AS "totalCommits",
        lines_added AS "linesAdded", lines_deleted AS "linesDeleted", files_modified AS "filesModified",
        timeline, commits_summary AS "commitsSummary",
        system_overview AS "systemOverview", role_and_ownership AS "roleAndOwnership",
        technical_challenges_solved AS "technicalChallengesSolved",
        work_description AS "workDescription", bullet_points AS "bulletPoints",
        most_effective_work_list AS "mostEffectiveWorkList",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_repositories
      ${whereClause}
      ORDER BY is_featured DESC, display_order ASC, total_commits DESC, updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataRes = await queryPostgres(dataSql, [...params, limit, offset]);

    return {
      repositories: dataRes.rows.map((r: any) => this.mapRow(r)),
      totalFound,
    };
  }

  /**
   * Quick lookup for featured / flagship projects for a user
   */
  async findFeatured(userId: string): Promise<UserWorkRepository[]> {
    const res = await this.findByUserId({
      userId,
      isFeatured: true,
      limit: 10,
    });
    return res.repositories;
  }

  /**
   * Deletes a repository record by ID or repositoryName
   */
  async delete(userId: string, idOrName: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
    const sql = isUuid
      ? `DELETE FROM user_repositories WHERE user_id = $1 AND id = $2`
      : `DELETE FROM user_repositories WHERE user_id = $1 AND repository_name = $2`;

    const res = await queryPostgres(sql, [userId, idOrName]);
    return (res.rowCount || 0) > 0;
  }
}

export const userWorkRepository = new UserWorkPostgresRepository();
