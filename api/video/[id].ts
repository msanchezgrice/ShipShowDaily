import type { VercelRequest, VercelResponse } from '@vercel/node';

// Social media bot user agents
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'slackbot',
  'telegrambot',
  'discordbot',
  'pinterest',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userAgent = req.headers['user-agent'] || '';
  const idOrSlug = req.query.id as string;

  // If not a bot, redirect to the SPA
  if (!isBot(userAgent)) {
    res.setHeader('Location', `/video/${idOrSlug}`);
    return res.status(302).end();
  }

  // For bots, serve OG metadata
  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).send('Server error');
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Support both UUID and slug lookup
    const result = await db.execute(sql`
      SELECT 
        v.id, v.slug, v.title, v.description, v.thumbnail_path as "thumbnailPath",
        v.total_views as "totalViews", v.product_url as "productUrl",
        u.email as "creatorEmail", u.first_name as "creatorFirstName", u.last_name as "creatorLastName"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE (v.id = ${idOrSlug} OR v.slug = ${idOrSlug}) AND v.is_active = true
    `);

    if (!result.length) {
      return res.status(404).send('Video not found');
    }

    const video = result[0] as any;
    const creatorName = video.creatorFirstName && video.creatorLastName
      ? `${video.creatorFirstName} ${video.creatorLastName}`
      : video.creatorEmail?.split('@')[0] || 'Anonymous';

    const baseUrl = 'https://www.shipshow.io';
    // Use slug for canonical URL if available, otherwise use ID
    const videoUrl = `${baseUrl}/video/${video.slug || video.id}`;
    const title = video.title || 'Demo Video';
    const description = video.description || `Watch ${title} on ShipShow - Daily Demo Leaderboard`;
    const image = video.thumbnailPath || `${baseUrl}/og-image.png`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ShipShow</title>
  
  <meta name="title" content="${escapeHtml(title)} | ShipShow">
  <meta name="description" content="${escapeHtml(description)}">
  
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${videoUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="ShipShow">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${videoUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <meta name="author" content="${escapeHtml(creatorName)}">
  <link rel="canonical" href="${videoUrl}">
  
  <meta http-equiv="refresh" content="0;url=${videoUrl}">
</head>
<body>
  <p>Redirecting to <a href="${videoUrl}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('OG meta error:', error);
    return res.status(500).send('Server error');
  } finally {
    if (client) await client.end();
  }
}
