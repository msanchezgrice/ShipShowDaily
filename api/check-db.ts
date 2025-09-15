import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Dynamic imports
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    
    // Parse DATABASE_URL to check configuration
    const dbUrl = process.env.DATABASE_URL || '';
    const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
    
    const client = postgres(dbUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);
    
    // Get current database info
    const dbInfo = await db.execute(sql`SELECT current_database(), current_schema(), version()`);
    
    // Check all schemas
    const schemas = await db.execute(sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `);
    
    // Check tables in all relevant schemas
    const tables = await db.execute(sql`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `);
    
    // Try to check if users table exists specifically
    let userTableExists = false;
    let userCount = 0;
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      userTableExists = true;
      userCount = parseInt(result.rows?.[0]?.count || '0');
    } catch (e) {
      // Table doesn't exist
    }
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      database: {
        current_database: dbInfo.rows?.[0]?.current_database,
        current_schema: dbInfo.rows?.[0]?.current_schema,
        version: dbInfo.rows?.[0]?.version?.split(' ')[0],
        host: urlParts?.[3] || 'unknown',
      },
      schemas: schemas.rows?.map(r => r.schema_name) || [],
      tables: tables.rows?.map(r => `${r.schemaname}.${r.tablename}`) || [],
      userTableExists,
      userCount,
    });
    
  } catch (error: any) {
    console.error('Database check error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      hint: error.hint,
      detail: error.detail,
    });
  }
}