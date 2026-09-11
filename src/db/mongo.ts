import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;

function getEffectiveTimeout(customTimeout?: number): number {
  if (customTimeout !== undefined) return customTimeout;
  return process.env.NODE_ENV === "test" ? 800 : config.mongodb.connectTimeoutMS;
}

export function getMongoClient(timeoutMs?: number): MongoClient {
  if (!clientInstance) {
    const timeout = getEffectiveTimeout(timeoutMs);
    clientInstance = new MongoClient(config.mongodb.uri, {
      connectTimeoutMS: timeout,
      serverSelectionTimeoutMS: timeout,
    });
  }
  return clientInstance;
}

export async function getMongoDb(): Promise<Db> {
  if (!dbInstance) {
    const client = getMongoClient();
    await client.connect();
    dbInstance = client.db(config.mongodb.dbName);
  }
  return dbInstance;
}

export async function testMongoConnection(timeoutMs?: number): Promise<{ ok: boolean; error?: string }> {
  const timeout = getEffectiveTimeout(timeoutMs);
  const tempClient = new MongoClient(config.mongodb.uri, {
    connectTimeoutMS: timeout,
    serverSelectionTimeoutMS: timeout,
  });

  try {
    await tempClient.connect();
    await tempClient.db(config.mongodb.dbName).command({ ping: 1 });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    await tempClient.close().catch(() => {});
  }
}

export async function closeMongo(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    dbInstance = null;
  }
}
