import "dotenv/config";
import { getRedisClient, closeRedis } from "./db/redis.js";

async function main() {
  console.log(`[Redis Check] Attempting to connect to: ${process.env.REDIS_URL?.replace(/:[^:@]+@/, ":***@") || "redis://localhost:6379"}`);
  
  try {
    const client = await getRedisClient();
    const pingResult = await client.ping();
    
    if (pingResult === "PONG") {
      console.log("✅ SUCCESS: Successfully connected to Redis! Received PONG.");
    } else {
      console.log(`⚠️ UNKNOWN: Connected, but received unexpected ping response: ${pingResult}`);
    }
  } catch (error: any) {
    console.error("❌ ERROR: Failed to connect to Redis.");
    console.error(error.message || error);
  } finally {
    await closeRedis();
    process.exit(0);
  }
}

main();
