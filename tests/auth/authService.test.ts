import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authService } from "../../src/auth/services/authService.js";
import { userRepository } from "../../src/user/repositories/userRepository.js";
import { ConflictError, AppError } from "../../src/utils/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Mock dependencies
vi.mock("../../src/user/repositories/userRepository.js", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    passwordHash: "hashed-password",
    firstName: "John",
    lastName: "Doe",
    createdAt: new Date(),
  };

  describe("register", () => {
    const registerInput = {
      email: "test@example.com",
      password: "securepassword",
      firstName: "John",
      lastName: "Doe",
    };

    it("should successfully register a user and return a token", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);
      vi.mocked(bcrypt.hash).mockResolvedValueOnce("hashed-password" as any);
      vi.mocked(userRepository.create).mockResolvedValueOnce(mockUser);
      vi.mocked(jwt.sign).mockReturnValueOnce("mock-jwt-token" as any);

      const result = await authService.register(registerInput);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(registerInput.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        email: registerInput.email,
        passwordHash: "hashed-password",
      }));
      expect(jwt.sign).toHaveBeenCalled();
      
      expect(result.token).toBe("mock-jwt-token");
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(result.user.email).toBe(mockUser.email);
    });

    it("should throw ConflictError if user exists", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(mockUser);

      await expect(authService.register(registerInput)).rejects.toThrow(ConflictError);
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    const loginInput = {
      email: "test@example.com",
      password: "securepassword",
    };

    it("should login successfully and return token", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as any);
      vi.mocked(jwt.sign).mockReturnValueOnce("mock-jwt-token" as any);

      const result = await authService.login(loginInput);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginInput.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginInput.password, mockUser.passwordHash);
      
      expect(result.token).toBe("mock-jwt-token");
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("should throw AppError if user not found", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);

      await expect(authService.login(loginInput)).rejects.toThrow(AppError);
    });

    it("should throw AppError if password incorrect", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as any);

      await expect(authService.login(loginInput)).rejects.toThrow(AppError);
    });
  });
});
