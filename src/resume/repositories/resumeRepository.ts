import { getMongoDb } from "../../db/index.js";
import type { Resume, CreateResumeInput } from "../models/resume.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

const COLLECTION_NAME = "resumes";

export class ResumeRepository {
  async create(userId: string, data: CreateResumeInput): Promise<Resume> {
    const db = await getMongoDb();
    const collection = db.collection<Resume>(COLLECTION_NAME);
    
    const newResume: Resume = {
      ...data,
      id: randomUUID(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await collection.insertOne(newResume);
      return newResume;
    } catch (error) {
      logger.error("Error inserting resume into MongoDB", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Resume | null> {
    const db = await getMongoDb();
    const collection = db.collection<Resume>(COLLECTION_NAME);
    
    return await collection.findOne({ id }, { projection: { _id: 0 } });
  }

  async findByUserId(userId: string): Promise<Resume[]> {
    const db = await getMongoDb();
    const collection = db.collection<Resume>(COLLECTION_NAME);
    
    return await collection.find({ userId }, { projection: { _id: 0 } }).toArray();
  }

  async findByJobId(userId: string, jobId: string): Promise<Resume | null> {
    const db = await getMongoDb();
    const collection = db.collection<Resume>(COLLECTION_NAME);

    // Return the latest resume linked to this job for this user
    return await collection.findOne(
      { userId, jobId },
      { sort: { updatedAt: -1, createdAt: -1 }, projection: { _id: 0 } }
    );
  }

  async updatePdfUrl(
    id: string,
    pdfUrl: string,
    fileKey?: string,
    jobId?: string
  ): Promise<Resume | null> {
    const db = await getMongoDb();
    const collection = db.collection<Resume>(COLLECTION_NAME);

    const updateFields: any = {
      pdfUrl,
      updatedAt: new Date(),
    };
    if (fileKey) {
      updateFields.fileKey = fileKey;
    }
    if (jobId) {
      updateFields.jobId = jobId;
    }

    const result = await collection.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { returnDocument: "after", projection: { _id: 0 } }
    );

    return (result as unknown as Resume) || null;
  }

  /**
   * Performs a Semantic Search using MongoDB Atlas Vector Search
   */
  async findSimilarResumes(userId: string, queryVector: number[], limit: number = 3): Promise<(Resume & { score: number })[]> {
    const db = await getMongoDb();
    const collection = db.collection(COLLECTION_NAME);

    try {
      // Uses MongoDB Atlas $vectorSearch for hardware-accelerated cosine similarity
      const cursor = collection.aggregate([
        {
          $vectorSearch: {
            index: "resume_embedding_index", // Name of the Atlas Search Index
            path: "embedding",               // The field containing the vector
            queryVector: queryVector,        // The embedding of the job description
            numCandidates: 10,               // Candidates to evaluate
            limit: limit,                    // Final results to return
            filter: { userId: { $eq: userId } } // Ensure users only match against their OWN resumes
          }
        },
        {
          $project: {
            _id: 0,
            score: { $meta: "vectorSearchScore" }, // Extract the similarity score
            id: 1,
            userId: 1,
            title: 1,
            skills: 1,
            experience: 1,
            education: 1,
            createdAt: 1,
            updatedAt: 1,
          }
        }
      ]);

      return (await cursor.toArray()) as (Resume & { score: number })[];
    } catch (error) {
      logger.error(`Error performing $vectorSearch in Atlas`, error);
      throw error;
    }
  }

  /**
   * Automatically creates the Vector Search Index in MongoDB Atlas if it doesn't exist.
   * Note: This requires the MongoDB Node Driver v6+ and connecting to an Atlas Cluster.
   */
  async setupIndexes(): Promise<void> {
    const db = await getMongoDb();
    
    // 1. Ensure collection exists first (MongoDB creates collections lazily, 
    //    so creating an index on a non-existent collection will fail)
    const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
    if (collections.length === 0) {
      logger.info(`[Database] Collection '${COLLECTION_NAME}' does not exist. Creating it...`);
      await db.createCollection(COLLECTION_NAME);
    }
    
    const collection = db.collection(COLLECTION_NAME);

    try {
      // Create the Atlas Vector Search index programmatically
      const searchIndexes = await collection.listSearchIndexes().toArray();
      const indexExists = searchIndexes.some((idx: any) => idx.name === "resume_embedding_index");

      if (!indexExists) {
        logger.info("[Database] Creating MongoDB Atlas Vector Search index for resumes...");
        await collection.createSearchIndex({
          name: "resume_embedding_index",
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: 1536,
                similarity: "cosine"
              },
              {
                type: "filter",
                path: "userId"
              }
            ]
          }
        });
        logger.info("[Database] Vector Search index 'resume_embedding_index' creation initiated! (Note: Atlas builds this in the background).");
      } else {
        logger.info("[Database] Vector Search index 'resume_embedding_index' already exists.");
      }
    } catch (error: any) {
      logger.warn("[Database] Could not verify/create Atlas Search Indexes automatically. If you are running MongoDB locally without Atlas, Vector Search will not work.", error.message);
    }
  }
}

export const resumeRepository = new ResumeRepository();
