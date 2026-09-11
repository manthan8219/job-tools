import { createTool } from "@mastra/core/tools";
import { authService } from "../../auth/services/authService.js";
import { LoginSchema, RegisterSchema } from "../../auth/models/auth.js";

export const registerTool = createTool({
  id: "register-user",
  description: "Registers a new user account with an email and password, returning an access token.",
  inputSchema: RegisterSchema,
  execute: async (input) => {
    try {
      const result = await authService.register(input);
      return {
        success: true,
        message: "Registration successful",
        data: result,
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

export const loginTool = createTool({
  id: "login-user",
  description: "Authenticates a user with email and password, returning a JWT access token.",
  inputSchema: LoginSchema,
  execute: async (input) => {
    try {
      const result = await authService.login(input);
      return {
        success: true,
        message: "Login successful",
        data: result,
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
