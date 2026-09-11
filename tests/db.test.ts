import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { config } from "../src/config.js";
import {
  getPostgresPool,
  closePostgres,
  testPostgresConnection,
  queryPostgres,
} from "../src/db/postgres.js";
import {
  getMongoClient,
  closeMongo,
  testMongoConnection,
} from "../src/db/mongo.js";
import { checkDatabasesHealth, closeAllDatabases } from "../src/db/index.js";

describe("Database Configuration", () => {
  it("should have valid configuration defaults for Postgres and MongoDB", () => {
    expect(config.postgres.connectionString).toBeDefined();
    expect(config.postgres.maxConnections).toBeGreaterThan(0);
    expect(config.mongodb.uri).toBeDefined();
    expect(config.mongodb.dbName).toBe("job_applier_db");
  });
});

describe("PostgreSQL Connection Manager", () => {
  afterEach(async () => {
    await closePostgres();
  });

  it("should return a singleton Pool instance", () => {
    const pool1 = getPostgresPool();
    const pool2 = getPostgresPool();
    expect(pool1).toBeDefined();
    expect(pool1).toBe(pool2);
  });

  it("should close pool cleanly and re-instantiate on next call", async () => {
    const pool1 = getPostgresPool();
    await closePostgres();
    const pool2 = getPostgresPool();
    expect(pool1).not.toBe(pool2);
  });

  it("should handle connection test failure gracefully without unhandled exception", async () => {
    // Attempting connection to a non-existent database port/host should return ok: false with error
    const result = await testPostgresConnection();
    expect(result).toHaveProperty("ok");
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });
});

describe("MongoDB Connection Manager", () => {
  afterEach(async () => {
    await closeMongo();
  });

  it("should return a singleton MongoClient instance", () => {
    const client1 = getMongoClient();
    const client2 = getMongoClient();
    expect(client1).toBeDefined();
    expect(client1).toBe(client2);
  });

  it("should close client cleanly and re-instantiate on next call", async () => {
    const client1 = getMongoClient();
    await closeMongo();
    const client2 = getMongoClient();
    expect(client1).not.toBe(client2);
  });

  it("should handle connection test failure gracefully without crashing", async () => {
    const result = await testMongoConnection();
    expect(result).toHaveProperty("ok");
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });
});

describe("Unified Database Health & Lifecycle", () => {
  afterEach(async () => {
    await closeAllDatabases();
  });

  it("should return health status structure for both databases", async () => {
    const health = await checkDatabasesHealth();
    expect(health).toHaveProperty("postgres");
    expect(health).toHaveProperty("mongodb");
    expect(typeof health.postgres.ok).toBe("boolean");
    expect(typeof health.mongodb.ok).toBe("boolean");
  });
});
