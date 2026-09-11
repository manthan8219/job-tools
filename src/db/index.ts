import { testPostgresConnection, closePostgres } from "./postgres.js";
import { testMongoConnection, closeMongo } from "./mongo.js";

export * from "./postgres.js";
export * from "./mongo.js";

export interface DatabaseHealthStatus {
  postgres: { ok: boolean; error?: string };
  mongodb: { ok: boolean; error?: string };
}

export async function checkDatabasesHealth(): Promise<DatabaseHealthStatus> {
  const [postgresHealth, mongoHealth] = await Promise.all([
    testPostgresConnection(),
    testMongoConnection(),
  ]);

  return {
    postgres: postgresHealth,
    mongodb: mongoHealth,
  };
}

export async function closeAllDatabases(): Promise<void> {
  await Promise.allSettled([closePostgres(), closeMongo()]);
}
