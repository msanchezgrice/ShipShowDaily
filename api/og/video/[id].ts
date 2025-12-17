import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    const result = await db.execute(sql`
      SELECT 
        v.id, v.title, v.description, v.thumbnail_path as "thumbnailPath",
        v.total_views as "totalViews", v.product_url as "productUrl",
        u.email as "creatorEmail", u.first_name as "creatorFirstName", u.last_name as "creatorLastName"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE v.id = ${videoId} AND v.is_active = true
    `);

    if (!result.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = result[0] as any;
    const creatorName = video.creatorFirstName && video.creatorLastName
      ? `${video.creatorFirstName} ${video.creatorLastName}`
      : video.creatorEmail?.split('@')[0] || 'Anonymous';

    const baseUrl = 'https://www.shipshow.io';
    const videoUrl = `${baseUrl}/video/${videoId}`;
    const title = video.title || 'Demo Video';
    const description = video.description || `Watch ${title} on ShipShow - Daily Demo Leaderboard`;
    const image = video.thumbnailPath || `${baseUrl}/og-default.png`;

    // Return HTML with OG meta tags for social sharing
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ShipShow</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="${escapeHtml(title)} | ShipShow">
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${videoUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="ShipShow">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${videoUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">
  
  <!-- Video specific -->
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  
  <!-- Additional -->
  <meta name="author" content="${escapeHtml(creatorName)}">
  <link rel="canonical" href="${videoUrl}">
  
  <!-- Redirect to actual video page -->
  <meta http-equiv="refresh" content="0;url=${videoUrl}">
  <script>window.location.href = "${videoUrl}";</script>
</head>
<body>
  <p>Redirecting to <a href="${videoUrl}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('OG meta error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate OG metadata' });
  } finally {
    if (client) await client.end();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
