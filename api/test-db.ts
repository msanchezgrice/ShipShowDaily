import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUser, getFeedVideos, getTodayStats } from './_lib/data';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Test the new data layer
    const stats = await getTodayStats();
    const feed = await getFeedVideos({ limit: 3 });
    
    return res.status(200).json({
      success: true,
      stats,
      feedCount: feed.length,
      firstVideo: feed[0] ? { id: feed[0].video.id, title: feed[0].video.title } : null
    });
    
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}
