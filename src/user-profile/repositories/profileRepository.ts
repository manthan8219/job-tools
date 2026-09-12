import { queryPostgres } from "../../db/index.js";
import { JobApplication, UserStats } from "../models/profile.js";
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
      logger.info("job_applications table initialized");
    } catch (error) {
      logger.error("Failed to initialize job_applications table", error);
    }
  }

  async addApplication(app: JobApplication): Promise<JobApplication> {
    const id = app.id || randomUUID();
    const appliedDate = app.appliedDate ? new Date(app.appliedDate) : new Date();
    
    await queryPostgres(
      `INSERT INTO job_applications (id, user_id, company_name, job_title, status, job_url, notes, applied_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, app.userId, app.companyName, app.jobTitle, app.status, app.jobUrl || null, app.notes || null, appliedDate]
    );

    return { ...app, id, appliedDate: appliedDate.toISOString() };
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const result = await queryPostgres(
      `SELECT status, COUNT(*) as count FROM job_applications WHERE user_id = $1 GROUP BY status`,
      [userId]
    );

    const stats: UserStats = {
      totalApplications: 0,
      interviewing: 0,
      offers: 0,
      rejected: 0,
    };

    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      stats.totalApplications += count;
      if (row.status === 'interviewing') stats.interviewing += count;
      if (row.status === 'offer') stats.offers += count;
      if (row.status === 'rejected') stats.rejected += count;
    }

    return stats;
  }
  
  async getApplications(userId: string): Promise<JobApplication[]> {
     const result = await queryPostgres(
      `SELECT id, user_id, company_name, job_title, status, job_url, notes, applied_date 
       FROM job_applications 
       WHERE user_id = $1 
       ORDER BY applied_date DESC`,
      [userId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      companyName: row.company_name,
      jobTitle: row.job_title,
      status: row.status,
      jobUrl: row.job_url,
      notes: row.notes,
      appliedDate: row.applied_date ? new Date(row.applied_date).toISOString() : undefined
    }));
  }
}

export const profileRepository = new ProfileRepository();
