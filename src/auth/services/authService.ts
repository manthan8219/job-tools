import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { userRepository } from "../../user/repositories/userRepository.js";
import { ConflictError, AppError } from "../../utils/index.js";
import { LoginSchema, RegisterSchema, type LoginInput, type RegisterInput, type AuthPayload } from "../models/auth.js";

// Hardcoded for now, would typically be in config
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-do-not-use-in-prod";
const JWT_EXPIRES_IN = "24h";

export class AuthService {
  async register(data: unknown): Promise<AuthPayload> {
    const parsedData = RegisterSchema.parse(data);

    // Check for existing user
    const existingUser = await userRepository.findByEmail(parsedData.email);
    if (existingUser) {
      throw new ConflictError(`User with email ${parsedData.email} already exists`);
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(parsedData.password, saltRounds);

    // Create user in DB
    const newUser = await userRepository.create({
      email: parsedData.email,
      passwordHash,
      firstName: parsedData.firstName,
      lastName: parsedData.lastName,
      mobileNumber: parsedData.mobileNumber,
    });

    // Generate JWT
    const token = this.generateToken(newUser.id);

    // Omit passwordHash for response
    const { passwordHash: _, ...safeUser } = newUser;

    return { token, user: safeUser as any };
  }

  async login(data: unknown): Promise<AuthPayload> {
    const parsedData = LoginSchema.parse(data);

    // Find user
    const user = await userRepository.findByEmail(parsedData.email);
    if (!user || !user.passwordHash) {
      throw new AppError("Invalid email or password", "UNAUTHORIZED", 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(parsedData.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", "UNAUTHORIZED", 401);
    }

    // Generate JWT
    const token = this.generateToken(user.id);

    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser as any };
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
}

export const authService = new AuthService();
