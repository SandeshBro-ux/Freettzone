import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string' || !url.includes('tiktok.com')) {
    return res.status(400).json({ error: 'Invalid TikTok URL' });
  }

  try {
    console.log(`Fetching watermark-free video for URL: ${url}`);
    
    // First, we need to get the video ID from the TikTok URL
    const videoIdMatch = url.match(/\/video\/(\d+)/i);
    if (!videoIdMatch || !videoIdMatch[1]) {
      return res.status(400).json({ error: 'Could not extract video ID from URL' });
    }
    
    const videoId = videoIdMatch[1];
    console.log(`Extracted video ID: ${videoId}`);
    
    // Fetch the TikTok page HTML to extract the video URL
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const htmlContent = response.data;

    // Try to find the JSON data containing video URLs
    const scriptRegex = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.+?)<\/script>/;
    const scriptMatch = htmlContent.match(scriptRegex);
    
    if (!scriptMatch || !scriptMatch[1]) {
      return res.status(404).json({ error: 'Could not extract video data from TikTok' });
    }
    
    try {
      const jsonData = JSON.parse(scriptMatch[1]);
      
      // Extract video URL from JSON data
      const videoData = jsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
      
      if (!videoData || !videoData.video) {
        return res.status(404).json({ error: 'Video data not found' });
      }
      
      // First try to get the downloadAddr (HD) if available
      let videoUrl = videoData.video.downloadAddr || videoData.video.playAddr;
      console.log(`Found original video URL: ${videoUrl}`);
      
      // Check if we have the direct video URL in another property
      if (videoData.video.urls && videoData.video.urls.length > 0) {
        videoUrl = videoData.video.urls[0];
        console.log(`Using alternative direct URL: ${videoUrl}`);
      }
      
      // Set the response type to redirect to save bandwidth
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="tiktok_${videoId}_no_watermark.mp4"`);
      
      // Redirect to the direct video URL (client will handle the download)
      return res.redirect(302, videoUrl);
    } catch (error) {
      console.error('Error processing video data:', error);
      return res.status(500).json({ error: 'Failed to process video data' });
    }
  } catch (error: any) {
    console.error('Error fetching video:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch video' });
  }
} 