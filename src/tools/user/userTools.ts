import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { userService } from "../../user/services/userService.js";
import { CreateUserSchema } from "../../user/models/user.js";
import { withAuth } from "../../auth/middleware.js";

export const createUserTool = createTool({
  id: "create-user",
  description: "Creates a new user profile with email, first name, last name, and optional mobile number.",
  inputSchema: CreateUserSchema,
  execute: async (input) => {
    try {
      const user = await userService.createUser(input);
      return {
        success: true,
        message: `User created successfully with ID ${user.id}`,
        user,
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

export const getUserTool = createTool({
  id: "get-user",
  description: "Retrieves a user profile by their unique ID. Requires authentication.",
  inputSchema: z.object({
    id: z.string().uuid().describe("The unique UUID of the user to retrieve"),
  }),
  execute: withAuth(async ({ id }) => {
    try {
      const user = await userService.getUser(id);
      return {
        success: true,
        user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.name || "Error",
        message: error.message,
      };
    }
  }),
});