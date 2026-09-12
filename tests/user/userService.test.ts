import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { userService } from "../../src/user/services/userService.js";
import { userRepository } from "../../src/user/repositories/userRepository.js";
import { ConflictError, NotFoundError } from "../../src/utils/index.js";

// Mock the repository layer
vi.mock("../../src/user/repositories/userRepository.js", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock the user profile service
vi.mock("../../src/user-profile/services/userProfileService.js", () => ({
  userProfileService: {
    createUserStats: vi.fn(),
  },
}));

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    mobileNumber: "1234567890",
    createdAt: new Date(),
  };

  describe("createUser", () => {
    const validInput = {
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      mobileNumber: "1234567890",
    };

    it("should successfully create a new user", async () => {
      const { userProfileService } = await import("../../src/user-profile/services/userProfileService.js");
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null); // Not found
      vi.mocked(userRepository.create).mockResolvedValueOnce(mockUser);
      vi.mocked(userProfileService.createUserStats).mockResolvedValueOnce({} as any);

      const result = await userService.createUser(validInput);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(validInput.email);
      expect(userRepository.create).toHaveBeenCalledWith(validInput);
      expect(userProfileService.createUserStats).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it("should throw ConflictError if user with email already exists", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(mockUser);

      await expect(userService.createUser(validInput)).rejects.toThrow(ConflictError);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it("should throw ZodError if input validation fails", async () => {
      const invalidInput = { email: "not-an-email", firstName: "John" };
      await expect(userService.createUser(invalidInput)).rejects.toThrow(); // ZodError
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe("getUser", () => {
    it("should return user if found", async () => {
      vi.mocked(userRepository.findById).mockResolvedValueOnce(mockUser);

      const result = await userService.getUser(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it("should throw NotFoundError if user does not exist", async () => {
      vi.mocked(userRepository.findById).mockResolvedValueOnce(null);

      await expect(userService.getUser("non-existent")).rejects.toThrow(NotFoundError);
    });
  });
});
