import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the user"),
  email: z.string().email().describe("User's email address"),
  passwordHash: z.string().optional().describe("Bcrypt password hash for local login"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  mobileNumber: z.string().optional().describe("Optional mobile phone number"),
  createdAt: z.date().optional(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
