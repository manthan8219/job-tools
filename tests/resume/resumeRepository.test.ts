import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resumeRepository } from "../../src/resume/repositories/resumeRepository.js";
import { getMongoDb } from "../../src/db/index.js";

// Mock the MongoDB database and collection
vi.mock("../../src/db/index.js", () => ({
  getMongoDb: vi.fn(),
}));

describe("ResumeRepository", () => {
  let mockCollection: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCollection = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue({ toArray: vi.fn() }),
      aggregate: vi.fn(),
    };

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };
    
    vi.mocked(getMongoDb).mockResolvedValue(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResume = {
    id: "uuid-1234",
    userId: "user-abcd",
    title: "Software Engineer",
    skills: ["TypeScript"],
    experience: [],
    education: [],
    embedding: [0.1, 0.2, 0.3],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("create", () => {
    it("should successfully insert a new resume into MongoDB", async () => {
      mockCollection.insertOne.mockResolvedValueOnce({ acknowledged: true });

      const input = {
        title: "Software Engineer",
        skills: ["TypeScript"],
        experience: [],
        education: [],
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await resumeRepository.create(mockResume.userId, input);

      expect(mockDb.collection).toHaveBeenCalledWith("resumes");
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        userId: mockResume.userId,
        title: input.title,
        embedding: input.embedding,
      }));
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(mockResume.userId);
    });
  });

  describe("findSimilarResumes", () => {
    it("should use MongoDB Atlas $vectorSearch pipeline correctly", async () => {
      const mockMatches = [{ ...mockResume, score: 0.95 }];
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce(mockMatches),
      });

      const queryVector = [0.1, 0.2, 0.3];
      const result = await resumeRepository.findSimilarResumes(mockResume.userId, queryVector, 5);

      expect(mockCollection.aggregate).toHaveBeenCalledTimes(1);
      
      const pipeline = mockCollection.aggregate.mock.calls[0][0];
      
      // Verify the $vectorSearch stage
      expect(pipeline[0]).toHaveProperty("$vectorSearch");
      expect(pipeline[0].$vectorSearch).toEqual({
        index: "resume_embedding_index",
        path: "embedding",
        queryVector: queryVector,
        numCandidates: 10,
        limit: 5,
        filter: { userId: { $eq: mockResume.userId } } // Only search this user's resumes
      });

      // Verify the projection stage extracts score
      expect(pipeline[1]).toHaveProperty("$project");
      expect(pipeline[1].$project.score).toEqual({ $meta: "vectorSearchScore" });

      expect(result).toEqual(mockMatches);
    });
  });
});
