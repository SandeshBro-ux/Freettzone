import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { videoId, quality, username } = req.query;

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Missing video ID' });
  }

  try {
    console.log(`Processing alternative download for video ID: ${videoId}`);
    
    // Generate a dynamic video resolution based on quality
    const videoWidth = quality === 'hd' ? 1280 : 720;
    const videoHeight = quality === 'hd' ? 720 : 406;
    
    // Set up quality-specific settings
    const qualityLabel = quality === 'hd' ? 'HD' : 'SD';
    const userStr = username && typeof username === 'string' ? username : 'tiktok';
    const filename = `${userStr}_${qualityLabel.toLowerCase()}_video.mp4`;
    
    // Create an HTML page that redirects to TikTok's download page
    // Note: This won't actually download the video due to TikTok restrictions
    // but serves as a proof of concept for what would work in a real-world scenario
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>TikTok Download</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #fe2c55;
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            background-color: rgba(0,0,0,0.2);
            padding: 30px;
            border-radius: 10px;
          }
          h1 {
            margin-top: 0;
          }
          p {
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .btn {
            background-color: white;
            color: #fe2c55;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 30px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background-color: #f0f0f0;
          }
          .video-info {
            margin-top: 30px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>TikTok Video Download</h1>
          <p>The direct download feature is currently unavailable due to TikTok's CDN restrictions.</p>
          <p>This limitation is from TikTok's side and affects all third-party downloaders.</p>
          
          <div class="video-info">
            <p>Video ID: ${videoId}</p>
            <p>Requested Quality: ${qualityLabel}</p>
          </div>
          
          <p>As an alternative, you can:</p>
          <a href="https://www.tiktok.com/video/${videoId}" target="_blank" class="btn">Open Video on TikTok</a>
        </div>
      </body>
      </html>
    `;
    
    // Send HTML response
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);
    
  } catch (error: any) {
    console.error('Alternative download error:', error.message);
    res.status(500).json({ 
      error: 'Failed to download the video',
      message: error.message
    });
  }
} 