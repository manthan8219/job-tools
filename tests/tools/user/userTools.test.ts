import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUserTool, getUserTool } from "../../../src/tools/user/userTools.js";
import { userService } from "../../../src/user/services/userService.js";
import { ConflictError, NotFoundError } from "../../../src/utils/index.js";

// Mock the service layer
vi.mock("../../../src/user/services/userService.js", () => ({
  userService: {
    createUser: vi.fn(),
    getUser: vi.fn(),
  },
}));

describe("User MCP Tools (Controllers)", () => {
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

  describe("createUserTool", () => {
    const validInput = {
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      mobileNumber: "1234567890",
    };

    it("should return success when user is created", async () => {
      vi.mocked(userService.createUser).mockResolvedValueOnce(mockUser);

      const result = await createUserTool.execute(validInput);

      expect(userService.createUser).toHaveBeenCalledWith(validInput);
      expect(result).toEqual({
        success: true,
        message: `User created successfully with ID ${mockUser.id}`,
        user: mockUser,
      });
    });

    it("should return error when ConflictError is thrown", async () => {
      const error = new ConflictError("Email exists");
      vi.mocked(userService.createUser).mockRejectedValueOnce(error);

      const result = await createUserTool.execute(validInput);

      expect(result).toEqual({
        success: false,
        error: "ConflictError",
        message: "Email exists",
      });
    });
  });

  describe("getUserTool", () => {
    it("should return success when user is found", async () => {
      vi.mocked(userService.getUser).mockResolvedValueOnce(mockUser);

      const result = await getUserTool.execute({ id: mockUser.id });

      expect(userService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        success: true,
        user: mockUser,
      });
    });

    it("should return error when NotFoundError is thrown", async () => {
      const error = new NotFoundError("User");
      vi.mocked(userService.getUser).mockRejectedValueOnce(error);

      const result = await getUserTool.execute({ id: mockUser.id });

      expect(result).toEqual({
        success: false,
        error: "NotFoundError",
        message: "User not found",
      });
    });
  });
});
