import { getRedisClient } from "../../db/redis.js";
import type { Resume } from "../models/resume.js";
import { logger } from "../../utils/index.js";

// Cache TTL: 24 hours (86,400 seconds)
const RESUME_TTL_SECONDS = 86400;

export class ResumeCache {
  private getResumeKey(id: string): string {
    return `resume:${id}`;
  }

  private getUserResumesKey(userId: string): string {
    return `user:${userId}:resumes`;
  }

  private getUserLatestResumeKey(userId: string): string {
    return `user:${userId}:latest_resume`;
  }

  private getUserJobResumeKey(userId: string, jobId: string): string {
    return `user:${userId}:job:${jobId}:resume`;
  }

  /**
   * Safely serializes a Resume to JSON string
   */
  private serialize(resume: Resume): string {
    return JSON.stringify(resume);
  }

  /**
   * Safely deserializes JSON string back to Resume with Date instances
   */
  private deserialize(jsonString: string): Resume | null {
    try {
      const data = JSON.parse(jsonString);
      return {
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      };
    } catch (err) {
      logger.warn("[ResumeCache] Failed to parse cached resume JSON", err);
      return null;
    }
  }

  /**
   * Caches a newly created or updated resume in Redis.
   * Stores by resume ID and user latest resume key, and clears user resume list cache to maintain consistency.
   */
  async cacheResume(resume: Resume): Promise<void> {
    try {
      const redis = await getRedisClient();
      const resumeKey = this.getResumeKey(resume.id);
      const latestKey = this.getUserLatestResumeKey(resume.userId);
      const userListKey = this.getUserResumesKey(resume.userId);

      const serialized = this.serialize(resume);

      const ops: Promise<any>[] = [
        redis.set(resumeKey, serialized, { EX: RESUME_TTL_SECONDS }),
        redis.set(latestKey, serialized, { EX: RESUME_TTL_SECONDS }),
        redis.del(userListKey),
      ];

      if (resume.jobId) {
        const jobResumeKey = this.getUserJobResumeKey(resume.userId, resume.jobId);
        ops.push(redis.set(jobResumeKey, serialized, { EX: RESUME_TTL_SECONDS }));
      }

      await Promise.allSettled(ops);

      logger.info(`[ResumeCache] Successfully cached resume ${resume.id} for user ${resume.userId} in Redis`);
    } catch (error: any) {
      logger.warn(`[ResumeCache] Could not cache resume ${resume.id} in Redis: ${error.message}`);
    }
  }

  /**
   * Retrieves a cached resume created specifically for a given job.
   */
  async getCachedResumeByJob(userId: string, jobId: string): Promise<Resume | null> {
    try {
      const redis = await getRedisClient();
      const key = this.getUserJobResumeKey(userId, jobId);
      const data = await redis.get(key);

      if (!data) return null;

      logger.info(`[ResumeCache] Cache HIT for user ${userId} job ${jobId} resume`);
      return this.deserialize(data);
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to get cached job resume for user ${userId} job ${jobId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieves a cached resume by its unique ID
   */
  async getCachedResume(id: string): Promise<Resume | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getResumeKey(id));
      if (!raw) return null;

      const parsed = this.deserialize(raw);
      if (parsed) {
        logger.info(`[ResumeCache] Cache HIT for resume ${id}`);
      }
      return parsed;
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to get cached resume ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieves all cached resumes for a specific user
   */
  async getCachedUserResumes(userId: string): Promise<Resume[] | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getUserResumesKey(userId));
      if (!raw) return null;

      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        logger.info(`[ResumeCache] Cache HIT for user ${userId} resumes (${list.length} found)`);
        return list.map((item: any) => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
        }));
      }
      return null;
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to get cached user resumes for ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Caches a user's entire resume list and primes individual resume entries
   */
  async cacheUserResumes(userId: string, resumes: Resume[]): Promise<void> {
    try {
      const redis = await getRedisClient();
      const userListKey = this.getUserResumesKey(userId);
      const serializedList = JSON.stringify(resumes);

      const tasks: Promise<any>[] = [
        redis.set(userListKey, serializedList, { EX: RESUME_TTL_SECONDS }),
      ];

      for (const resume of resumes) {
        tasks.push(
          redis.set(this.getResumeKey(resume.id), this.serialize(resume), {
            EX: RESUME_TTL_SECONDS,
          })
        );
      }

      if (resumes.length > 0) {
        tasks.push(
          redis.set(this.getUserLatestResumeKey(userId), this.serialize(resumes[0]), {
            EX: RESUME_TTL_SECONDS,
          })
        );
      }

      await Promise.allSettled(tasks);
      logger.info(`[ResumeCache] Successfully cached ${resumes.length} resumes for user ${userId}`);
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to cache user resumes for ${userId}: ${error.message}`);
    }
  }

  /**
   * Retrieves the latest cached resume for a user
   */
  async getCachedLatestResume(userId: string): Promise<Resume | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getUserLatestResumeKey(userId));
      if (!raw) return null;

      const parsed = this.deserialize(raw);
      if (parsed) {
        logger.info(`[ResumeCache] Cache HIT for user ${userId} latest resume`);
      }
      return parsed;
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to get latest cached resume for ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Explicitly sets the latest resume for a user
   */
  async cacheLatestResume(userId: string, resume: Resume): Promise<void> {
    try {
      const redis = await getRedisClient();
      const latestKey = this.getUserLatestResumeKey(userId);
      await redis.set(latestKey, this.serialize(resume), { EX: RESUME_TTL_SECONDS });
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to cache latest resume for ${userId}: ${error.message}`);
    }
  }

  /**
   * Invalidates cached resume and related user cache entries
   */
  async invalidateResume(id: string, userId?: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      const tasks = [redis.del(this.getResumeKey(id))];
      if (userId) {
        tasks.push(redis.del(this.getUserResumesKey(userId)));
        tasks.push(redis.del(this.getUserLatestResumeKey(userId)));
      }
      await Promise.allSettled(tasks);
      logger.info(`[ResumeCache] Invalidated cache for resume ${id}`);
    } catch (error: any) {
      logger.warn(`[ResumeCache] Failed to invalidate cache for resume ${id}: ${error.message}`);
    }
  }
}

export const resumeCache = new ResumeCache();
