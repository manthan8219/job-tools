import { getMongoDb } from "../../db/mongo.js";
import { OnboardingState } from "../models/onboarding.js";

const COLLECTION_NAME = "user_onboarding";

export class OnboardingRepository {
  async getStatus(userId: string): Promise<OnboardingState | null> {
    const db = await getMongoDb();
    const result = await db.collection(COLLECTION_NAME).findOne({ userId });
    
    if (!result) return null;
    
    return {
      userId: result.userId,
      isCompleted: result.isCompleted,
      completedAt: result.completedAt,
    };
  }

  async markCompleted(userId: string): Promise<void> {
    const db = await getMongoDb();
    await db.collection(COLLECTION_NAME).updateOne(
      { userId },
      {
        $set: {
          userId,
          isCompleted: true,
          completedAt: new Date(),
        }
      },
      { upsert: true }
    );
  }
}

export const onboardingRepository = new OnboardingRepository();
