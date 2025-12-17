/**
 * Database connection with dynamic imports for Vercel serverless compatibility.
 * All imports are done dynamically to avoid ESM/CommonJS issues.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Singleton instances
let _db: PostgresJsDatabase<any> | null = null;
let _sql: any = null;

/**
 * Get or create database connection.
 * Uses dynamic imports to work in Vercel serverless environment.
 */
export async function getDatabase() {
  if (_db) return { db: _db, sql: _sql };
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  // Dynamic imports for serverless compatibility
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const schema = await import('../../shared/schema');
  
  _sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
    prepare: false,
  });
  
  _db = drizzle(_sql, { schema });
  
  return { db: _db, sql: _sql, schema };
}

/**
 * Execute a database operation with automatic connection handling.
 * This is the recommended way to use the database in API handlers.
 */
export async function withDb<T>(
  operation: (ctx: { 
    db: PostgresJsDatabase<any>; 
    schema: typeof import('../../shared/schema');
    eq: typeof import('drizzle-orm').eq;
    desc: typeof import('drizzle-orm').desc;
    and: typeof import('drizzle-orm').and;
    or: typeof import('drizzle-orm').or;
    sql: typeof import('drizzle-orm').sql;
    gte: typeof import('drizzle-orm').gte;
    lt: typeof import('drizzle-orm').lt;
    like: typeof import('drizzle-orm').like;
  }) => Promise<T>
): Promise<T> {
  const { db } = await getDatabase();
  const schema = await import('../../shared/schema');
  const drizzleOps = await import('drizzle-orm');
  
  return operation({
    db,
    schema,
    eq: drizzleOps.eq,
    desc: drizzleOps.desc,
    and: drizzleOps.and,
    or: drizzleOps.or,
    sql: drizzleOps.sql,
    gte: drizzleOps.gte,
    lt: drizzleOps.lt,
    like: drizzleOps.like,
  });
}
