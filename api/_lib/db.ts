import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from "../../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in environment variables");
}

// Use require for postgres to avoid ESM default import issues
const postgres = require('postgres');

// Create postgres connection for Supabase
const connectionString = process.env.DATABASE_URL;

// Postgres.js configuration for Supabase
const sql = postgres(connectionString, {
  max: 1, // Serverless should use single connections
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require', // Supabase requires SSL
  prepare: false, // Disable prepared statements for serverless
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(sql, { schema });

// Export schema for convenience
export * from "../../shared/schema";
