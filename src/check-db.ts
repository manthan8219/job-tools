import "dotenv/config";
import { getMongoDb, closeAllDatabases } from "./db/index.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { logger } from "./utils/index.js";

async function verifyMongoOnly() {
  logger.info("Bypassing Postgres - Testing MongoDB Atlas connection exclusively...");
  
  try {
    const db = await getMongoDb();
    logger.info(`✅ Connected to MongoDB! Database Name: ${db.databaseName}`);
    
    logger.info("Step 1: Running Resume Vector Index Setup on MongoDB Atlas...");
    await resumeRepository.setupIndexes();

    logger.info("Step 2: Testing Database Write (Inserting a dummy resume)...");
    const dummyUserId = "test-user-1234";
    const dummyResume = await resumeRepository.create(dummyUserId, {
      title: "AI Engineer",
      skills: ["Python", "TypeScript", "AI"],
      experience: [],
      education: [],
      embedding: Array(1536).fill(0.1), // Dummy 1536-dimensional vector
    });
    logger.info(`✅ Dummy resume inserted successfully! Resume ID: ${dummyResume.id}`);

    logger.info("Step 3: Testing Database Read...");
    const fetchedResumes = await resumeRepository.findByUserId(dummyUserId);
    logger.info(`✅ Found ${fetchedResumes.length} resume(s) for the test user.`);

    // Cleanup: We don't want to pollute your real database, so we'll delete the dummy document
    logger.info("Step 4: Cleaning up dummy data...");
    await db.collection("resumes").deleteOne({ id: dummyResume.id });
    logger.info("✅ Cleanup successful.");

    logger.info("🎉 MongoDB Atlas is 100% working and ready to go!");
    
  } catch (err: any) {
    logger.error("❌ MongoDB Test Failed:", err.message);
  } finally {
    await closeAllDatabases();
    process.exit(0);
  }
}

verifyMongoOnly();
