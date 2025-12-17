import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "../../shared/schema";

// Lazy initialization for serverless functions
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in environment variables");
  }
  
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
    prepare: false,
  });
  
  _db = drizzle(sql, { schema });
  return _db;
}

// Export a proxy that lazily initializes the db
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});

// Export schema for convenience
export * from "../../shared/schema";
