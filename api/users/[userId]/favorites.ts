import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Get user's favorited videos
    const favoritesResult = await db.execute(sql`
      SELECT 
        v.id, v.slug, v.title, v.description, v.product_url as "productUrl",
        v.thumbnail_path as "thumbnailPath", v.total_views as "totalViews",
        v.created_at as "createdAt",
        u.id as "creatorId", u.first_name as "creatorFirstName", 
        u.last_name as "creatorLastName", u.email as "creatorEmail",
        u.profile_image_url as "creatorProfileImageUrl",
        vf.created_at as "favoritedAt"
      FROM video_favorites vf
      INNER JOIN videos v ON vf.video_id = v.id
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE vf.user_id = ${userId} AND v.is_active = true
      ORDER BY vf.created_at DESC
      LIMIT 20
    `);

    const favorites = favoritesResult.map((f: any) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      description: f.description,
      productUrl: f.productUrl,
      thumbnailPath: f.thumbnailPath,
      totalViews: parseInt(f.totalViews) || 0,
      createdAt: f.createdAt,
      favoritedAt: f.favoritedAt,
      creator: {
        id: f.creatorId,
        firstName: f.creatorFirstName,
        lastName: f.creatorLastName,
        email: f.creatorEmail,
        profileImageUrl: f.creatorProfileImageUrl,
      }
    }));

    return res.status(200).json(favorites);
  } catch (error: any) {
    console.error('User favorites error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user favorites' });
  } finally {
    if (client) await client.end();
  }
}
