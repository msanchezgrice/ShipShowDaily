/**
 * Server-side analytics using PostHog.
 * Tracks events for both logged-in and anonymous users.
 */

import { PostHog } from 'posthog-node';

let posthog: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!process.env.VITE_POSTHOG_KEY) {
    return null;
  }
  
  if (!posthog) {
    posthog = new PostHog(process.env.VITE_POSTHOG_KEY, {
      host: 'https://us.i.posthog.com',
      flushAt: 1, // Flush immediately for serverless
      flushInterval: 0,
    });
  }
  
  return posthog;
}

// Generate anonymous ID from request
function getAnonymousId(req: { headers: Record<string, any> }): string {
  // Use IP + User Agent as a simple anonymous ID
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
             req.headers['x-real-ip'] || 
             'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  
  // Simple hash
  const str = `${ip}-${ua}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `anon_${Math.abs(hash).toString(36)}`;
}

interface TrackOptions {
  userId?: string | null;
  req?: { headers: Record<string, any> };
  properties?: Record<string, any>;
}

/**
 * Track an event. Works for both logged-in and anonymous users.
 */
export function trackEvent(
  eventName: string,
  options: TrackOptions = {}
) {
  const ph = getPostHog();
  if (!ph) return;
  
  const { userId, req, properties = {} } = options;
  
  // Use userId if available, otherwise generate anonymous ID
  const distinctId = userId || (req ? getAnonymousId(req) : `anon_${Date.now()}`);
  
  ph.capture({
    distinctId,
    event: eventName,
    properties: {
      ...properties,
      $set: userId ? { user_id: userId } : undefined,
      is_anonymous: !userId,
      source: 'server',
    },
  });
}

// ============ VIDEO EVENTS ============

export function trackVideoView(videoId: string, videoTitle: string, options: TrackOptions) {
  trackEvent('video_viewed', {
    ...options,
    properties: {
      video_id: videoId,
      video_title: videoTitle,
    },
  });
}

export function trackVideoWatchComplete(videoId: string, watchDuration: number, options: TrackOptions) {
  trackEvent('video_watch_completed', {
    ...options,
    properties: {
      video_id: videoId,
      watch_duration_seconds: watchDuration,
    },
  });
}

export function trackVideoUpload(videoId: string, title: string, userId: string) {
  trackEvent('video_uploaded', {
    userId,
    properties: {
      video_id: videoId,
      title,
    },
  });
}

// ============ ENGAGEMENT EVENTS ============

export function trackFavorite(videoId: string, videoTitle: string, favorited: boolean, options: TrackOptions) {
  trackEvent(favorited ? 'video_favorited' : 'video_unfavorited', {
    ...options,
    properties: {
      video_id: videoId,
      video_title: videoTitle,
    },
  });
}

export function trackDemoClick(videoId: string, productUrl: string, options: TrackOptions) {
  trackEvent('demo_link_clicked', {
    ...options,
    properties: {
      video_id: videoId,
      product_url: productUrl,
    },
  });
}

export function trackShare(videoId: string, shareMethod: string, options: TrackOptions) {
  trackEvent('video_shared', {
    ...options,
    properties: {
      video_id: videoId,
      share_method: shareMethod,
    },
  });
}

// ============ USER EVENTS ============

export function trackSignUp(userId: string, method: string) {
  trackEvent('user_signed_up', {
    userId,
    properties: {
      method,
    },
  });
}

export function trackSignIn(userId: string) {
  trackEvent('user_signed_in', {
    userId,
  });
}

// ============ FLUSH ============

export async function flushAnalytics() {
  const ph = getPostHog();
  if (ph) {
    await ph.flush();
  }
}
