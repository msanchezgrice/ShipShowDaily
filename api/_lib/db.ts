import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "../../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in environment variables");
}

// Create postgres connection for Supabase
const connectionString = process.env.DATABASE_URL;

// Postgres.js automatically handles connection pooling
const sql = postgres(connectionString, {
  max: 1, // Serverless should use single connections
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

// Export schema for convenience
export * from "../../shared/schema";
