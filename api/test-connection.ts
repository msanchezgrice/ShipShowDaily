import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check environment variables
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      return res.status(500).json({ 
        error: 'DATABASE_URL not found',
        env: Object.keys(process.env).filter(k => k.includes('DATABASE'))
      });
    }

    // Try basic node-postgres connection
    const { Client } = await import('pg');
    
    console.log('Testing with node-postgres...');
    console.log('Database URL format:', dbUrl.substring(0, 30) + '...');
    
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query('SELECT NOW() as current_time, COUNT(*) as user_count FROM users');
    console.log('Query successful');
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      timestamp: result.rows[0]?.current_time,
      userCount: result.rows[0]?.user_count,
      message: 'Database connection working with node-postgres'
    });
    
  } catch (error: any) {
    console.error('Database connection error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      code: error.code,
      detail: error.detail || 'No additional details'
    });
  }
}
