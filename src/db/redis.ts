import { createClient, RedisClientType } from "redis";
import { config } from "../config.js";
import { logger } from "../utils/index.js";

let redisClientInstance: RedisClientType | null = null;
let connectingPromise: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClientInstance && redisClientInstance.isOpen) {
    return redisClientInstance;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      const client = createClient({
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              return false; // Stop retrying after 3 attempts
            }
            return Math.min(retries * 50, 500);
          },
        },
      }) as RedisClientType;

      client.on("error", (err) => {
        logger.error("Redis Client Error", err);
      });

      client.on("connect", () => {
        logger.info("Connected to Redis");
      });

      await client.connect();
      redisClientInstance = client;
      return client;
    } catch (error) {
      logger.warn("Failed to establish Redis connection", error);
      redisClientInstance = null;
      throw error;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export async function closeRedis(): Promise<void> {
  if (redisClientInstance) {
    try {
      if (redisClientInstance.isOpen) {
        await redisClientInstance.quit();
      }
    } catch (err) {
      logger.warn("Error closing Redis client", err);
    } finally {
      redisClientInstance = null;
    }
  }
}
