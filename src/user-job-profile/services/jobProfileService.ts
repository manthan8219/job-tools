import { jobProfileRepository } from "../repositories/jobProfileRepository.js";
import { UserJobProfile, UserJobProfileSchema } from "../models/jobProfile.js";
import { NotFoundError } from "../../utils/index.js";

export class JobProfileService {
  async init() {
    await jobProfileRepository.initTables();
  }

  async getProfile(userId: string): Promise<UserJobProfile> {
    const profile = await jobProfileRepository.getProfile(userId);
    if (!profile) {
      throw new NotFoundError(`Job profile for user ID ${userId}`);
    }
    return profile;
  }

  async upsertProfile(data: unknown): Promise<UserJobProfile> {
    // Validate the input data against our schema
    const parsedData = UserJobProfileSchema.parse(data);
    return await jobProfileRepository.upsertProfile(parsedData);
  }
}

export const jobProfileService = new JobProfileService();
