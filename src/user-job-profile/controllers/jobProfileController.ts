import { IncomingMessage, ServerResponse } from "node:http";
import { jobProfileService } from "../services/jobProfileService.js";
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

export class JobProfileController {
  
  /**
   * Endpoint to retrieve user job profile.
   * GET /api/user-job-profile/:userId
   */
  async getProfile(req: IncomingMessage, res: ServerResponse, userId: string) {
    try {
      if (!userId) {
        return sendJson(res, 400, { success: false, message: "userId is required" });
      }

      const profile = await jobProfileService.getProfile(userId);
      
      return sendJson(res, 200, {
        success: true,
        data: profile
      });
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return sendJson(res, 404, { success: false, message: error.message });
      }
      logger.error("Error retrieving job profile", error);
      return sendJson(res, 500, { 
        success: false, 
        message: "Failed to retrieve job profile",
        error: error.message
      });
    }
  }

  /**
   * Endpoint to create or update a user job profile.
   * POST /api/user-job-profile
   */
  async upsertProfile(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await getJsonBody(req);

      const profile = await jobProfileService.upsertProfile(body);
      
      return sendJson(res, 200, {
        success: true,
        message: "Job profile saved successfully",
        data: profile
      });
    } catch (error: any) {
      logger.error("Error saving job profile", error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return sendJson(res, 400, {
          success: false,
          message: "Validation failed",
          errors: error.errors
        });
      }

      return sendJson(res, 500, { 
        success: false, 
        message: "Failed to save job profile",
        error: error.message
      });
    }
  }
}

export const jobProfileController = new JobProfileController();
