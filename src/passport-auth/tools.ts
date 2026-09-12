import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { passportAuthService } from "./authService.js";
import { LoginSchema } from "../auth/models/auth.js";
import { UserSchema } from "../user/models/user.js";

const PassportAuthPayloadSchema = z.object({
  accessToken: z.string().describe("JWT access token for API calls"),
  refreshToken: z.string().describe("JWT refresh token for generating new access tokens"),
  user: UserSchema.omit({ passwordHash: true }).describe("Authenticated user profile"),
});

export const passportLoginTool = createTool({
  id: "passport-login-user",
  description: "Authenticates a user via Passport.js, returning both an access and refresh token. Will abort execution if authentication fails.",
  inputSchema: LoginSchema,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: PassportAuthPayloadSchema.optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const result = await passportAuthService.login(input);
      return {
        success: true,
        message: "Login successful with Passport.js",
        data: result,
      };
    } catch (error: any) {
      // Return the error gracefully or let it throw so the system aborts.
      // Based on "we are going to kill the thing if not okay" we will throw.
      throw new Error(error.message || "Authentication failed");
    }
  },
});

export const passportLogoutTool = createTool({
  id: "passport-logout-user",
  description: "Logs out a user and revokes their session/tokens.",
  inputSchema: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (input) => {
    try {
      await passportAuthService.logout(input.userId);
      return {
        success: true,
        message: "Logout successful",
      };
    } catch (error: any) {
      throw new Error(error.message || "Logout failed");
    }
  },
});
