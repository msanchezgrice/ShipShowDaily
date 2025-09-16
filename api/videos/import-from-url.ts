import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { scrapeProductPage, ScrapeError } from '../../server/scraper';
import { storage } from '../_lib/storage';
import { insertVideoWithTagsSchema } from '@shared/schema';
import { z } from 'zod';

export default requireAuth(async function handler(
  req: VercelRequest,
  res: VercelResponse,
  user: any
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = user.id;
  const { sourceUrl, preferredVideoUrl, overrides, tags: rawTags } = req.body ?? {};

  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return res.status(400).json({ message: 'sourceUrl is required.' });
  }

  try {
    const scrapeResult = await scrapeProductPage(sourceUrl);
    const availableVideos = scrapeResult.videoSources;

    if (!availableVideos.length) {
      return res.status(422).json({ message: 'No downloadable demo videos were found on this page.' });
    }

    let chosenVideo = availableVideos[0];
    if (preferredVideoUrl && typeof preferredVideoUrl === 'string') {
      const match = availableVideos.find(video => video.url === preferredVideoUrl.trim());
      if (match) {
        chosenVideo = match;
      }
    }

    const sanitizeText = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const explicitTitle = sanitizeText(overrides?.title);
    const explicitDescription = sanitizeText(overrides?.description);
    const explicitProductUrl = sanitizeText(overrides?.productUrl);
    const explicitThumbnail = sanitizeText(overrides?.thumbnailUrl);

    const defaultTitle = scrapeResult.title ?? `Imported demo from ${new URL(scrapeResult.originalUrl).hostname}`;
    const defaultDescription = scrapeResult.description ?? `Demo imported from ${scrapeResult.originalUrl}`;
    const defaultProductUrl = scrapeResult.canonicalUrl ?? scrapeResult.originalUrl;

    const tagSet = new Set<string>();
    if (Array.isArray(rawTags)) {
      for (const tag of rawTags) {
        if (typeof tag === 'string') {
          const trimmed = tag.trim();
          if (trimmed) {
            tagSet.add(trimmed.slice(0, 50));
          }
        }
      }
    }

    for (const tag of scrapeResult.tags) {
      if (typeof tag === 'string') {
        const trimmed = tag.trim();
        if (trimmed) {
          tagSet.add(trimmed.slice(0, 50));
        }
      }
    }

    const combinedTags = Array.from(tagSet).slice(0, 10);

    const videoPayload = insertVideoWithTagsSchema.parse({
      title: explicitTitle ?? defaultTitle,
      description: explicitDescription ?? defaultDescription,
      productUrl: explicitProductUrl ?? defaultProductUrl,
      videoPath: chosenVideo.url,
      thumbnailPath: explicitThumbnail ?? scrapeResult.thumbnailUrl,
      creatorId: userId,
      provider: chosenVideo.type === 'hls' ? 'stream' : 's3',
      hls_url: chosenVideo.type === 'hls' ? chosenVideo.url : undefined,
      duration_s: scrapeResult.durationSeconds,
      tags: combinedTags,
      status: 'ready',
    });

    const video = await storage.createVideoWithTags(videoPayload);

    res.status(201).json({
      video,
      metadata: scrapeResult,
      selectedVideo: chosenVideo,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid video data generated from scrape', errors: error.errors });
    }
    console.error('Error importing video from URL:', error);
    res.status(500).json({ message: 'Failed to import video from the provided URL.' });
  }
});