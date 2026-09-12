import { queryPostgres } from "../../db/index.js";
import type { User, CreateUserInput } from "../models/user.js";
import { logger } from "../../utils/index.js";
import { randomUUID } from "node:crypto";

export class UserRepository {
  async init(): Promise<void> {
    try {
      await queryPostgres(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          mobile_number VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      logger.info("Initialized users table in PostgreSQL");
    } catch (error) {
      logger.error("Failed to initialize users table", error);
      throw error;
    }
  }
  async findById(id: string): Promise<User | null> {
    try {
      const result = await queryPostgres<User>(
        "SELECT id, email, password_hash AS \"passwordHash\", first_name AS \"firstName\", last_name AS \"lastName\", mobile_number AS \"mobileNumber\", created_at AS \"createdAt\" FROM users WHERE id = $1",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by id ${id}`, error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await queryPostgres<User>(
        "SELECT id, email, password_hash AS \"passwordHash\", first_name AS \"firstName\", last_name AS \"lastName\", mobile_number AS \"mobileNumber\", created_at AS \"createdAt\" FROM users WHERE email = $1",
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by email ${email}`, error);
      throw error;
    }
  }

  async create(user: CreateUserInput): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date();

    try {
      const result = await queryPostgres<User>(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, mobile_number, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, password_hash AS "passwordHash", first_name AS "firstName", last_name AS "lastName", mobile_number AS "mobileNumber", created_at AS "createdAt"`,
        [id, user.email, user.passwordHash || null, user.firstName, user.lastName, user.mobileNumber || null, createdAt]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating user", error);
      throw error;
    }
  }
}

export const userRepository = new UserRepository();
