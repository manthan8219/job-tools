import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

function getEffectiveTimeout(customTimeout?: number): number {
  if (customTimeout !== undefined) return customTimeout;
  return process.env.NODE_ENV === "test" ? 1000 : 5000;
}

export function getPostgresPool(connectionTimeoutMillis?: number): pg.Pool {
  if (!poolInstance) {
    const timeout = getEffectiveTimeout(connectionTimeoutMillis);
    poolInstance = new Pool({
      connectionString: config.postgres.connectionString,
      max: config.postgres.maxConnections,
      idleTimeoutMillis: config.postgres.idleTimeoutMillis,
      connectionTimeoutMillis: timeout,
    });

    poolInstance.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return poolInstance;
}

export async function testPostgresConnection(
  connectionTimeoutMillis?: number
): Promise<{ ok: boolean; error?: string }> {
  const timeout = getEffectiveTimeout(connectionTimeoutMillis);
  const tempPool = new Pool({
    connectionString: config.postgres.connectionString,
    max: 1,
    connectionTimeoutMillis: timeout,
  });

  try {
    const client = await tempPool.connect();
    try {
      await client.query("SELECT 1 AS health");
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    await tempPool.end().catch(() => {});
  }
}

export async function queryPostgres<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const pool = getPostgresPool();
  return pool.query<T>(text, params);
}

export async function closePostgres(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
