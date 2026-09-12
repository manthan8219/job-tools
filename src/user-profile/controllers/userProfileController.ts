import { IncomingMessage, ServerResponse } from "node:http";
import { userProfileService } from "../services/userProfileService.js";
import { logger } from "../../utils/index.js";

// Helper function to read JSON body
async function getJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

// Helper function to send JSON response
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export class UserProfileController {
  
  /**
   * Endpoint to initialize a blank user_stats row for a user.
   * This should be called as soon as a userProfile is created.
   * POST /api/user-profile/stats
   */
  async createUserStats(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await getJsonBody(req);
      const { userId } = body;

      if (!userId) {
        return sendJson(res, 400, { success: false, message: "userId is required" });
      }

      const stats = await userProfileService.createUserStats(userId);
      
      return sendJson(res, 201, {
        success: true,
        message: "User stats initialized successfully",
        data: stats
      });
    } catch (error: any) {
      logger.error("Error creating user stats", error);
      return sendJson(res, 500, { 
        success: false, 
        message: "Failed to create user stats",
        error: error.message
      });
    }
  }

  /**
   * Endpoint to retrieve user stats.
   * GET /api/user-profile/stats/:userId
   */
  async getUserStats(req: IncomingMessage, res: ServerResponse, userId: string) {
    try {
      if (!userId) {
        return sendJson(res, 400, { success: false, message: "userId is required" });
      }

      const stats = await userProfileService.getStats(userId);
      
      return sendJson(res, 200, {
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error("Error retrieving user stats", error);
      return sendJson(res, 500, { 
        success: false, 
        message: "Failed to retrieve user stats",
        error: error.message
      });
    }
  }
}

export const userProfileController = new UserProfileController();
