import { z } from "zod";
import { UserSchema } from "../../user/models/user.js";

export const LoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  mobileNumber: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const AuthPayloadSchema = z.object({
  token: z.string().describe("JWT access token"),
  user: UserSchema.omit({ passwordHash: true }).describe("Authenticated user profile"),
});

export type AuthPayload = z.infer<typeof AuthPayloadSchema>;
