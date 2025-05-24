import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Create temp directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp');
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating temp directory:', error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { url, quality, username } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing video URL' });
  }

  try {
    console.log(`Downloading TikTok video for: ${url}`);
    
    // Set quality identifier for filename
    const qualityLabel = quality === 'hd' ? 'hd' : 'sd';
    
    // Set filename with username if available
    const userStr = username && typeof username === 'string' ? username : 'tiktok';
    const filename = `${userStr}_${qualityLabel}_video.mp4`;
    
    // Use a simple URL with no query parameters (to avoid CDN blocks)
    const simplifiedUrl = url.split('?')[0];
    console.log(`Using simplified URL: ${simplifiedUrl}`);
    
    // Generate a temporary file path for storing the video
    const timestamp = Date.now();
    const tempFilePath = path.join(tempDir, `${timestamp}_${filename}`);
    
    // Download the video with custom headers to avoid CDN restrictions
    try {
      // Make direct request to the video URL with very specific headers
      // simulating a browser request from TikTok's own domain
      const videoResponse = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://www.tiktok.com',
          'Referer': 'https://www.tiktok.com/',
          'Range': 'bytes=0-',
          'Sec-Fetch-Dest': 'video',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'Connection': 'keep-alive',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
        },
        httpsAgent: new https.Agent({ 
          rejectUnauthorized: false,
        }),
        maxRedirects: 10,
        timeout: 30000
      });

      // Send the video as a download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', videoResponse.data.length);
      res.status(200).send(videoResponse.data);
      
      console.log(`Successfully served video download: ${filename}`);
    } catch (downloadError: any) {
      console.error(`Error downloading from direct URL: ${downloadError.message}`);
      
      // Try the server-side approach with a simple cached URL
      try {
        // Extract the video ID from the URL
        const matches = url.match(/\/([a-zA-Z0-9]+)(?:\?|\/|$)/);
        const videoId = matches ? matches[1] : 'video';
        
        // For this demo, we'll serve a static video file from the /public directory
        // or generate a simple data URL to demonstrate the concept
        
        // Create a simple data URL with a message
        const message = `Sorry, we can't download this specific TikTok video due to their CDN restrictions.`;
        const svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
            <rect width="800" height="400" fill="#fe2c55"/>
            <text x="400" y="200" font-family="Arial" font-size="24" fill="white" text-anchor="middle">${message}</text>
            <text x="400" y="250" font-family="Arial" font-size="18" fill="white" text-anchor="middle">Video ID: ${videoId}</text>
          </svg>
        `;
        const encodedSvg = Buffer.from(svgContent).toString('base64');
        const dataUrl = `data:image/svg+xml;base64,${encodedSvg}`;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `attachment; filename="tiktok_error_message.svg"`);
        res.status(200).send(Buffer.from(encodedSvg, 'base64'));
        
        console.log(`Served fallback data URL for video ID: ${videoId}`);
      } catch (fallbackError) {
        console.error('Fallback approach also failed:', fallbackError);
        res.status(500).json({ 
          error: 'Failed to download the video.',
          message: 'TikTok has blocked direct downloads of this video.',
          details: downloadError.message
        });
      }
    }
  } catch (error: any) {
    console.error('Video download error:', error.message);
    res.status(500).json({ 
      error: 'Failed to download the video',
      message: error.message
    });
  }
} 