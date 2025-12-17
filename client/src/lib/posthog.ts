import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;
  
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
  });
  
  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

// Key events for ShipShowDaily
export const Analytics = {
  // User events
  userSignedUp: (userId: string, method: string) => {
    posthog.capture('user_signed_up', { user_id: userId, method });
  },
  
  userSignedIn: (userId: string) => {
    posthog.capture('user_signed_in', { user_id: userId });
  },
  
  userSignedOut: () => {
    posthog.capture('user_signed_out');
  },

  // Video events
  videoUploaded: (videoId: string, title: string, tags?: string[]) => {
    posthog.capture('video_uploaded', { video_id: videoId, title, tags });
  },
  
  videoUploadStarted: () => {
    posthog.capture('video_upload_started');
  },
  
  videoUploadFailed: (error: string) => {
    posthog.capture('video_upload_failed', { error });
  },

  videoViewed: (videoId: string, videoTitle: string, creatorId: string) => {
    posthog.capture('video_viewed', { 
      video_id: videoId, 
      video_title: videoTitle,
      creator_id: creatorId 
    });
  },
  
  videoWatchCompleted: (videoId: string, watchDuration: number, creditEarned: boolean) => {
    posthog.capture('video_watch_completed', { 
      video_id: videoId, 
      watch_duration: watchDuration,
      credit_earned: creditEarned
    });
  },

  // Engagement events
  videoFavorited: (videoId: string, videoTitle: string) => {
    posthog.capture('video_favorited', { video_id: videoId, video_title: videoTitle });
  },
  
  demoLinkClicked: (videoId: string, productUrl: string) => {
    posthog.capture('demo_link_clicked', { video_id: videoId, product_url: productUrl });
  },
  
  videoBoosted: (videoId: string, creditsSpent: number) => {
    posthog.capture('video_boosted', { video_id: videoId, credits_spent: creditsSpent });
  },

  // Navigation events
  pageViewed: (pageName: string, properties?: Record<string, any>) => {
    posthog.capture('$pageview', { page: pageName, ...properties });
  },
  
  feedOpened: () => {
    posthog.capture('feed_opened');
  },
  
  leaderboardViewed: (sortBy: string) => {
    posthog.capture('leaderboard_viewed', { sort_by: sortBy });
  },

  // Credit events
  creditsEarned: (amount: number, source: string) => {
    posthog.capture('credits_earned', { amount, source });
  },
  
  creditsSpent: (amount: number, purpose: string) => {
    posthog.capture('credits_spent', { amount, purpose });
  },

  // Feature usage
  featureUsed: (featureName: string, properties?: Record<string, any>) => {
    posthog.capture('feature_used', { feature: featureName, ...properties });
  },
};

export { posthog };
