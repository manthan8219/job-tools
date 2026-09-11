import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  serverName: string;
  serverVersion: string;
  nodeEnv: string;
  postgres: {
    connectionString: string;
    maxConnections: number;
    idleTimeoutMillis: number;
  };
  mongodb: {
    uri: string;
    dbName: string;
    connectTimeoutMS: number;
  };
  redis: {
    url: string;
  };
}

export const config: AppConfig = {
  serverName: "job-applier-mcp",
  serverVersion: "0.1.0",
  nodeEnv: process.env.NODE_ENV || "development",
  postgres: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/job_applier_db",
    maxConnections: process.env.PG_MAX_CONNECTIONS
      ? parseInt(process.env.PG_MAX_CONNECTIONS, 10)
      : 10,
    idleTimeoutMillis: 30000,
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB_NAME || "job_applier_db",
    connectTimeoutMS: 5000,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
};
