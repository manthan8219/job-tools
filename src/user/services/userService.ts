import { userRepository } from "../repositories/userRepository.js";
import { CreateUserSchema, type User } from "../models/user.js";
import { ConflictError, NotFoundError } from "../../utils/index.js";

export class UserService {
  async createUser(data: unknown): Promise<User> {
    const parsedData = CreateUserSchema.parse(data);

    const existingUser = await userRepository.findByEmail(parsedData.email);
    if (existingUser) {
      throw new ConflictError(`User with email ${parsedData.email} already exists`);
    }

    return await userRepository.create(parsedData);
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
