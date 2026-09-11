import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { userRepository } from "../../src/user/repositories/userRepository.js";
import { queryPostgres } from "../../src/db/index.js";

// Mock the entire db layer
vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("UserRepository", () => {
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

  it("findById should return user when found", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockUser],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await userRepository.findById(mockUser.id);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(queryPostgres).toHaveBeenCalledWith(expect.any(String), [mockUser.id]);
    expect(result).toEqual(mockUser);
  });

  it("findById should return null when not found", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await userRepository.findById("non-existent");
    expect(result).toBeNull();
  });

  it("findByEmail should return user when found", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockUser],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await userRepository.findByEmail(mockUser.email);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(queryPostgres).toHaveBeenCalledWith(expect.any(String), [mockUser.email]);
    expect(result).toEqual(mockUser);
  });

  it("create should return the created user", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockUser],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    });

    const inputData = {
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      mobileNumber: "1234567890",
    };

    const result = await userRepository.create(inputData);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    
    // Check that we provided 7 arguments (id, email, password_hash, first_name, last_name, mobile_number, created_at)
    const callArgs = vi.mocked(queryPostgres).mock.calls[0][1];
    expect(callArgs).toBeDefined();
    expect(callArgs).toHaveLength(7);
    expect(callArgs?.[1]).toBe(inputData.email);
    expect(callArgs?.[3]).toBe(inputData.firstName); // shifted by 1 because of passwordHash at index 2
    
    expect(result).toEqual(mockUser);
  });
  
  it("should throw error if query fails", async () => {
    const error = new Error("Database connection failed");
    vi.mocked(queryPostgres).mockRejectedValueOnce(error);

    await expect(userRepository.findById("123")).rejects.toThrow("Database connection failed");
  });
});
