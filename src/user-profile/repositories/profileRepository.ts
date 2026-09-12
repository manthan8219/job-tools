import { queryPostgres } from "../../db/index.js";
import { UserStats } from "../models/profile.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class ProfileRepository {
  async initTables() {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS job_applications (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          job_title VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          job_url TEXT,
          notes TEXT,
          applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS user_stats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID UNIQUE NOT NULL,
          total_applications INT DEFAULT 0,
          interviewing INT DEFAULT 0,
          offers INT DEFAULT 0,
          rejected INT DEFAULT 0,
          referrals_asked INT DEFAULT 0,
          emails_sent INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          updated_by VARCHAR(255),
          deleted_at TIMESTAMP,
          deleted_by VARCHAR(255)
        )
      `);
      logger.info("Profile tables initialized");
    } catch (error) {
      logger.error("Failed to initialize profile tables", error);
    }
  }

  async createUserStats(userId: string): Promise<UserStats> {
    await queryPostgres(
      `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    return this.getUserStats(userId);
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const result = await queryPostgres(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // If no stats exist, create them or return default zeros
      return {
        userId,
        totalApplications: 0,
        interviewing: 0,
        offers: 0,
        rejected: 0,
        referralsAsked: 0,
        emailsSent: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      totalApplications: row.total_applications,
      interviewing: row.interviewing,
      offers: row.offers,
      rejected: row.rejected,
      referralsAsked: row.referrals_asked,
      emailsSent: row.emails_sent,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      deletedBy: row.deleted_by
    };
  }
}

export const profileRepository = new ProfileRepository();
