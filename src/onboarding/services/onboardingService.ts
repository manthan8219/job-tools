import { onboardingRepository } from "../repositories/onboardingRepository.js";
import { getRedisClient } from "../../db/redis.js";

const TTL_SECONDS = 60; // 1 minute TTL

export class OnboardingService {
  private getCacheKey(userId: string) {
    return `onboarding:completed:${userId}`;
  }

  async checkStatus(userId: string): Promise<boolean> {
    const redis = await getRedisClient();
    const cacheKey = this.getCacheKey(userId);
    
    // 1. Check Redis cache
    const cachedStatus = await redis.get(cacheKey);
    if (cachedStatus !== null) {
      return cachedStatus === "true";
    }

    // 2. Cache miss -> check MongoDB
    const status = await onboardingRepository.getStatus(userId);
    const isCompleted = status?.isCompleted ?? false;

    // 3. Store in cache with 1 minute TTL
    await redis.set(cacheKey, isCompleted ? "true" : "false", {
      EX: TTL_SECONDS
    });

    return isCompleted;
  }

  async completeOnboarding(userId: string): Promise<void> {
    // 1. Update MongoDB
    await onboardingRepository.markCompleted(userId);

    // 2. Update Redis Cache explicitly
    const redis = await getRedisClient();
    const cacheKey = this.getCacheKey(userId);
    await redis.set(cacheKey, "true", {
      EX: TTL_SECONDS
    });
  }
}

export const onboardingService = new OnboardingService();
