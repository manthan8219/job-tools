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
  storage: {
    provider: "local" | "s3-compatible";
    publicAppUrl: string;
    localDir: string;
    s3: {
      bucket: string;
      region: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
      forcePathStyle: boolean;
    };
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
  storage: {
    provider:
      (process.env.STORAGE_PROVIDER as "local" | "s3-compatible") ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET ? "s3-compatible" : "local"),
    publicAppUrl:
      process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`,
    localDir: process.env.STORAGE_LOCAL_DIR || "./uploads",
    s3: {
      bucket: process.env.S3_BUCKET || "",
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    },
  },
};
