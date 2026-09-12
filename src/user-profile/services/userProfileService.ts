import { profileRepository } from "../repositories/profileRepository.js";
import { JobApplication, UserStats } from "../models/profile.js";

export class UserProfileService {
  async init() {
    await profileRepository.initTables();
  }

  async trackApplication(data: unknown): Promise<JobApplication> {
    // We already validate via Zod schema in the tool, but we can just pass it through
    return await profileRepository.addApplication(data as JobApplication);
  }

  async getStats(userId: string): Promise<UserStats> {
    return await profileRepository.getUserStats(userId);
  }

  async getApplications(userId: string): Promise<JobApplication[]> {
    return await profileRepository.getApplications(userId);
  }
}

export const userProfileService = new UserProfileService();
