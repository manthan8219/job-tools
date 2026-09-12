import { userRepository } from "../repositories/userRepository.js";
import { CreateUserSchema, type User } from "../models/user.js";
import { ConflictError, NotFoundError } from "../../utils/index.js";

import { userProfileService } from "../../user-profile/services/userProfileService.js";

export class UserService {
  async createUser(data: unknown): Promise<User> {
    const parsedData = CreateUserSchema.parse(data);

    const existingUser = await userRepository.findByEmail(parsedData.email);
    if (existingUser) {
      throw new ConflictError(`User with email ${parsedData.email} already exists`);
    }

    const newUser = await userRepository.create(parsedData);
    
    // Automatically initialize the user_stats row for this new user
    if (newUser.id) {
      await userProfileService.createUserStats(newUser.id);
    }
    
    return newUser;
  }

  async getUser(id: string): Promise<User> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id}`);
    }
    return user;
  }
}

export const userService = new UserService();
