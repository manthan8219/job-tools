import { createClient, RedisClientType } from "redis";
import { config } from "../config.js";
import { logger } from "../utils/index.js";

let redisClientInstance: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClientInstance) {
    redisClientInstance = createClient({
      url: config.redis.url,
    }) as RedisClientType;

    redisClientInstance.on("error", (err) => {
      logger.error("Redis Client Error", err);
    });

    redisClientInstance.on("connect", () => {
      logger.info("Connected to Redis");
    });

    await redisClientInstance.connect();
  }

  return redisClientInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisClientInstance) {
    await redisClientInstance.quit();
    redisClientInstance = null;
  }
}
