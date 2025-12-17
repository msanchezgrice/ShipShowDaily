import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "../../shared/schema";

// Singleton db instance
let _db: ReturnType<typeof drizzle> | null = null;

// Initialize database - call this at the start of each handler
export async function initDb() {
  if (_db) return _db;
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  
  const postgres = (await import('postgres')).default;
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

// Get db instance (must call initDb first)
export function getDb() {
  if (!_db) throw new Error("Database not initialized - call initDb() first");
  return _db;
}

// For backward compatibility - returns a proxy that works after initDb is called
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return getDb()[prop as keyof typeof _db];
  }
});

// Export schema for convenience  
export * from "../../shared/schema";
