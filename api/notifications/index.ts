import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.DATABASE_URL || !process.env.CLERK_SECRET_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === 'true';

    // Get notifications
    let notificationsResult;
    if (unreadOnly) {
      notificationsResult = await db.execute(sql`
        SELECT 
          n.id, n.type, n.title, n.message, n.video_id as "videoId",
          n.actor_id as "actorId", n.is_read as "isRead", n.created_at as "createdAt",
          v.title as "videoTitle", v.thumbnail_path as "videoThumbnail", v.slug as "videoSlug",
          u.first_name as "actorFirstName", u.last_name as "actorLastName", 
          u.email as "actorEmail", u.profile_image_url as "actorImageUrl"
        FROM notifications n
        LEFT JOIN videos v ON n.video_id = v.id
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.user_id = ${userId} AND n.is_read = false
        ORDER BY n.created_at DESC
        LIMIT ${limit}
      `);
    } else {
      notificationsResult = await db.execute(sql`
        SELECT 
          n.id, n.type, n.title, n.message, n.video_id as "videoId",
          n.actor_id as "actorId", n.is_read as "isRead", n.created_at as "createdAt",
          v.title as "videoTitle", v.thumbnail_path as "videoThumbnail", v.slug as "videoSlug",
          u.first_name as "actorFirstName", u.last_name as "actorLastName", 
          u.email as "actorEmail", u.profile_image_url as "actorImageUrl"
        FROM notifications n
        LEFT JOIN videos v ON n.video_id = v.id
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.user_id = ${userId}
        ORDER BY n.created_at DESC
        LIMIT ${limit}
      `);
    }

    // Get unread count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ${userId} AND is_read = false
    `);

    const notifications = notificationsResult.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
      video: n.videoId ? {
        id: n.videoId,
        slug: n.videoSlug,
        title: n.videoTitle,
        thumbnailPath: n.videoThumbnail,
      } : null,
      actor: n.actorId ? {
        id: n.actorId,
        firstName: n.actorFirstName,
        lastName: n.actorLastName,
        email: n.actorEmail,
        profileImageUrl: n.actorImageUrl,
      } : null,
    }));

    return res.status(200).json({
      notifications,
      unreadCount: parseInt((countResult[0] as any).count) || 0,
    });
  } catch (error: any) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  } finally {
    if (client) await client.end();
  }
}
