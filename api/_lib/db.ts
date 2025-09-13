import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "../../shared/schema";

// Use built-in WebSocket in Vercel serverless environment
// No need to import ws module

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in environment variables");
}

// Create a new pool for each invocation in serverless
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Export schema for convenience
export * from "../../shared/schema";
