import {
  userWorkRepository,
  UserWorkPostgresRepository,
} from "../repositories/userWorkRepository.js";
import { userWorkCache, UserWorkCache } from "../cache/userWorkCache.js";
import {
  UserWorkRepository as UserWorkModel,
  SaveUserWorkInput,
  SaveUserWorkInputSchema,
  UserWorkFilter,
} from "../models/userWork.js";
import { logger, NotFoundError } from "../../utils/index.js";

export class UserWorkService {
  private repository: UserWorkPostgresRepository;
  private cache: UserWorkCache;

  constructor(
    repository: UserWorkPostgresRepository = userWorkRepository,
    cache: UserWorkCache = userWorkCache
  ) {
    this.repository = repository;
    this.cache = cache;
  }

  async init(): Promise<void> {
    await this.repository.init();
  }

  /**
   * Saves or updates a user repository and engineering work record
   */
  async saveWork(input: SaveUserWorkInput): Promise<UserWorkModel> {
    const validated = SaveUserWorkInputSchema.parse(input);
    const saved = await this.repository.upsert(validated);

    // Cache in Redis for sub-millisecond future retrieval
    await this.cache.cacheWork(saved);

    logger.info(`[UserWorkService] Saved and cached work for repo ${saved.repositoryName} (${saved.userId})`);
    return saved;
  }

  /**
   * Retrieves a single repository work item by ID
   */
  async getWorkById(id: string, userId?: string): Promise<UserWorkModel> {
    // 1. Check Redis cache first
    const cached = await this.cache.getCachedWorkById(id);
    if (cached) {
      if (userId && cached.userId !== userId) {
        throw new NotFoundError(`Repository work with ID ${id}`);
      }
      return cached;
    }

    // 2. Cache miss -> query PostgreSQL
    const work = await this.repository.findById(id);
    if (!work || (userId && work.userId !== userId)) {
      throw new NotFoundError(`Repository work with ID ${id}`);
    }

    // 3. Populate Redis cache
    await this.cache.cacheWork(work);
    return work;
  }

  /**
   * Retrieves a repository work item by user ID and repository name
   */
  async getWorkByRepo(userId: string, repositoryName: string): Promise<UserWorkModel | null> {
    // 1. Check Redis cache first
    const cached = await this.cache.getCachedWorkByRepo(userId, repositoryName);
    if (cached) {
      return cached;
    }

    // 2. Cache miss -> query PostgreSQL
    const work = await this.repository.findByUserAndRepo(userId, repositoryName);
    if (!work) {
      return null;
    }

    // 3. Populate Redis cache
    await this.cache.cacheWork(work);
    return work;
  }

  /**
   * Retrieves all repositories / work for a user with optional tier or language filters
   */
  async getUserWorkList(filter: UserWorkFilter): Promise<{ repositories: UserWorkModel[]; totalFound: number }> {
    const isUnfiltered = !filter.tier && filter.isFeatured === undefined && !filter.primaryLanguage && !filter.offset;

    // 1. If asking for standard list without filters, check Redis cache first
    if (isUnfiltered) {
      const cached = await this.cache.getCachedWorkList(filter.userId);
      if (cached) {
        const limit = filter.limit || 50;
        return {
          repositories: cached.slice(0, limit),
          totalFound: cached.length,
        };
      }
    }

    // 2. Cache miss or filtered query -> query PostgreSQL
    const result = await this.repository.findByUserId(filter);

    // 3. Populate Redis cache for default list
    if (isUnfiltered && result.repositories.length > 0) {
      await this.cache.cacheWorkList(filter.userId, result.repositories);
    }

    return result;
  }

  /**
   * Retrieves featured flagship projects for a user, using Redis cache
   */
  async getFeaturedWork(userId: string): Promise<UserWorkModel[]> {
    // 1. Check Redis cache first
    const cached = await this.cache.getCachedFeaturedWork(userId);
    if (cached) {
      return cached;
    }

    // 2. Cache miss -> query PostgreSQL
    const featured = await this.repository.findFeatured(userId);

    // 3. Populate Redis cache
    if (featured.length > 0) {
      await this.cache.cacheFeaturedWork(userId, featured);
    }

    return featured;
  }

  /**
   * Deletes a repository work item and invalidates cache
   */
  async deleteWork(userId: string, idOrName: string): Promise<boolean> {
    const deleted = await this.repository.delete(userId, idOrName);
    if (deleted) {
      await this.cache.invalidateWork(idOrName, userId, idOrName);
    }
    return deleted;
  }
}

export const userWorkService = new UserWorkService();
