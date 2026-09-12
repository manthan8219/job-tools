import { profileRepository } from "../repositories/profileRepository.js";
import { UserStats } from "../models/profile.js";

export class UserProfileService {
  async init() {
    await profileRepository.initTables();
  }

  async createUserStats(userId: string): Promise<UserStats> {
    return await profileRepository.createUserStats(userId);
  }

  async getStats(userId: string): Promise<UserStats> {
    return await profileRepository.getUserStats(userId);
  }
}

export const userProfileService = new UserProfileService();
