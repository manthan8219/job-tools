import { getRedisClient } from "../../db/redis.js";
import type { UserWorkRepository } from "../models/userWork.js";
import { logger } from "../../utils/index.js";

// Cache TTL: 24 hours (86,400 seconds)
const USER_WORK_TTL_SECONDS = 86400;

export class UserWorkCache {
  private getWorkIdKey(id: string): string {
    return `user_work:${id}`;
  }

  private getUserRepoKey(userId: string, repoName: string): string {
    return `user:${userId}:work:repo:${repoName.toLowerCase()}`;
  }

  private getUserListKey(userId: string): string {
    return `user:${userId}:work:list`;
  }

  private getUserFeaturedKey(userId: string): string {
    return `user:${userId}:work:featured`;
  }

  private serialize(item: any): string {
    return JSON.stringify(item);
  }

  private deserializeWork(jsonString: string): UserWorkRepository | null {
    try {
      const data = JSON.parse(jsonString);
      return {
        ...data,
        firstCommitDate: data.firstCommitDate ? new Date(data.firstCommitDate) : undefined,
        latestCommitDate: data.latestCommitDate ? new Date(data.latestCommitDate) : undefined,
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      };
    } catch (err) {
      logger.warn("[UserWorkCache] Failed to deserialize user work JSON", err);
      return null;
    }
  }

  private deserializeList(jsonString: string): UserWorkRepository[] | null {
    try {
      const list = JSON.parse(jsonString);
      if (!Array.isArray(list)) return null;
      return list.map((item: any) => ({
        ...item,
        firstCommitDate: item.firstCommitDate ? new Date(item.firstCommitDate) : undefined,
        latestCommitDate: item.latestCommitDate ? new Date(item.latestCommitDate) : undefined,
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
      }));
    } catch (err) {
      logger.warn("[UserWorkCache] Failed to deserialize user work list JSON", err);
      return null;
    }
  }

  /**
   * Caches a work item and invalidates aggregated lists to maintain consistency
   */
  async cacheWork(work: UserWorkRepository): Promise<void> {
    try {
      const redis = await getRedisClient();
      const idKey = this.getWorkIdKey(work.id);
      const repoKey = this.getUserRepoKey(work.userId, work.repositoryName);
      const listKey = this.getUserListKey(work.userId);
      const featuredKey = this.getUserFeaturedKey(work.userId);

      const serialized = this.serialize(work);

      await Promise.allSettled([
        redis.set(idKey, serialized, { EX: USER_WORK_TTL_SECONDS }),
        redis.set(repoKey, serialized, { EX: USER_WORK_TTL_SECONDS }),
        redis.del(listKey),
        redis.del(featuredKey),
      ]);

      logger.info(`[UserWorkCache] Cached repository ${work.repositoryName} (${work.id}) for user ${work.userId} in Redis`);
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Failed to cache user work ${work.id}: ${error.message}`);
    }
  }

  /**
   * Retrieves a single work item from cache by UUID
   */
  async getCachedWorkById(id: string): Promise<UserWorkRepository | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getWorkIdKey(id));
      if (!raw) return null;

      const item = this.deserializeWork(raw);
      if (item) {
        logger.info(`[UserWorkCache] Cache HIT for work id ${id}`);
      }
      return item;
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error getting cached work by id ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieves a work item by user ID and repository name from cache
   */
  async getCachedWorkByRepo(userId: string, repoName: string): Promise<UserWorkRepository | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getUserRepoKey(userId, repoName));
      if (!raw) return null;

      const item = this.deserializeWork(raw);
      if (item) {
        logger.info(`[UserWorkCache] Cache HIT for repo ${repoName} (user ${userId})`);
      }
      return item;
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error getting cached work by repo ${repoName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieves the full work list for a user from cache
   */
  async getCachedWorkList(userId: string): Promise<UserWorkRepository[] | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getUserListKey(userId));
      if (!raw) return null;

      const list = this.deserializeList(raw);
      if (list) {
        logger.info(`[UserWorkCache] Cache HIT for user ${userId} work list (${list.length} repos)`);
      }
      return list;
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error getting cached work list for ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Caches a user's full work list and primes individual repository keys
   */
  async cacheWorkList(userId: string, list: UserWorkRepository[]): Promise<void> {
    try {
      const redis = await getRedisClient();
      const listKey = this.getUserListKey(userId);
      const tasks: Promise<any>[] = [
        redis.set(listKey, this.serialize(list), { EX: USER_WORK_TTL_SECONDS }),
      ];

      // Prime individual repo keys
      for (const item of list) {
        tasks.push(
          redis.set(this.getWorkIdKey(item.id), this.serialize(item), { EX: USER_WORK_TTL_SECONDS })
        );
        tasks.push(
          redis.set(this.getUserRepoKey(userId, item.repositoryName), this.serialize(item), { EX: USER_WORK_TTL_SECONDS })
        );
      }

      await Promise.allSettled(tasks);
      logger.info(`[UserWorkCache] Cached ${list.length} work items for user ${userId}`);
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error caching work list for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Retrieves featured repositories for a user from cache
   */
  async getCachedFeaturedWork(userId: string): Promise<UserWorkRepository[] | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(this.getUserFeaturedKey(userId));
      if (!raw) return null;

      const list = this.deserializeList(raw);
      if (list) {
        logger.info(`[UserWorkCache] Cache HIT for user ${userId} featured work (${list.length} repos)`);
      }
      return list;
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error getting featured work for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Caches featured repositories for a user
   */
  async cacheFeaturedWork(userId: string, list: UserWorkRepository[]): Promise<void> {
    try {
      const redis = await getRedisClient();
      const featuredKey = this.getUserFeaturedKey(userId);
      await redis.set(featuredKey, this.serialize(list), { EX: USER_WORK_TTL_SECONDS });
      logger.info(`[UserWorkCache] Cached ${list.length} featured items for user ${userId}`);
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error caching featured work for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Invalidates cached keys for a repository
   */
  async invalidateWork(id: string, userId: string, repositoryName?: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      const tasks: Promise<any>[] = [
        redis.del(this.getWorkIdKey(id)),
        redis.del(this.getUserListKey(userId)),
        redis.del(this.getUserFeaturedKey(userId)),
      ];

      if (repositoryName) {
        tasks.push(redis.del(this.getUserRepoKey(userId, repositoryName)));
      }

      await Promise.allSettled(tasks);
      logger.info(`[UserWorkCache] Invalidated cache for work ${id} / user ${userId}`);
    } catch (error: any) {
      logger.warn(`[UserWorkCache] Error invalidating work cache: ${error.message}`);
    }
  }
}

export const userWorkCache = new UserWorkCache();
