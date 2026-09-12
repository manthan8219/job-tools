import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { userProfileService } from "../../user-profile/services/userProfileService.js";
import { getRedisClient } from "../../db/redis.js";


export const getUserStatsTool = createTool({
  id: "get-user-application-stats",
  description: "Retrieves comprehensive statistics for a user's job search. Returns real-time metrics including total applications, active interviews, offers received, rejections, referrals asked, and emails sent.",
  inputSchema: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  execute: async (input) => {
    try {
      const redis = await getRedisClient();
      const cacheKey = `user_stats:${input.userId}`;
      const cachedStats = await redis.get(cacheKey);

      if (cachedStats) {
        return {
          success: true,
          data: JSON.parse(cachedStats),
          source: "cache"
        };
      }

      const result = await userProfileService.getStats(input.userId);
      
      // Cache the result. When we create/update stats later, we will invalidate this cache key.
      await redis.set(cacheKey, JSON.stringify(result));
      
      return {
        success: true,
        data: result,
        source: "database"
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.name || "Error",
        message: error.message,
      };
    }
  },
});
