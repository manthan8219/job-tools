import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loginTool, registerTool } from "../../../src/tools/auth/authTools.js";
import { authService } from "../../../src/auth/services/authService.js";
import { AppError } from "../../../src/utils/index.js";

vi.mock("../../../src/auth/services/authService.js", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

describe("Auth MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAuthPayload = {
    token: "mock-token",
    user: {
      id: "123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
    } as any,
  };

  describe("registerTool", () => {
    const input = {
      email: "test@example.com",
      password: "password123",
      firstName: "John",
      lastName: "Doe",
    };

    it("should return success on valid registration", async () => {
      vi.mocked(authService.register).mockResolvedValueOnce(mockAuthPayload);

      const result = await registerTool.execute(input);

      expect(authService.register).toHaveBeenCalledWith(input);
      expect(result).toEqual({
        success: true,
        message: "Registration successful",
        data: mockAuthPayload,
      });
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(authService.register).mockRejectedValueOnce(new AppError("Failed", "FAIL"));

      const result = await registerTool.execute(input);
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("loginTool", () => {
    const input = {
      email: "test@example.com",
      password: "password123",
    };

    it("should return success on valid login", async () => {
      vi.mocked(authService.login).mockResolvedValueOnce(mockAuthPayload);

      const result = await loginTool.execute(input);

      expect(authService.login).toHaveBeenCalledWith(input);
      expect(result).toEqual({
        success: true,
        message: "Login successful",
        data: mockAuthPayload,
      });
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(new AppError("Invalid", "UNAUTHORIZED"));

      const result = await loginTool.execute(input);
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });
  });
});
