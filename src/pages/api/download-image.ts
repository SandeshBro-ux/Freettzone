import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { url, filename } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Image URL is required' });
  }

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Filename is required' });
  }

  try {
    const imageResponse = await axios.get(url, {
      responseType: 'arraybuffer', // Crucial for handling binary image data
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Determine content type from the original response or infer from filename
    let contentType = imageResponse.headers['content-type'];
    if (!contentType) {
      const extension = filename.split('.').pop()?.toLowerCase();
      if (extension === 'jpg' || extension === 'jpeg') {
        contentType = 'image/jpeg';
      } else if (extension === 'png') {
        contentType = 'image/png';
      } else if (extension === 'gif') {
        contentType = 'image/gif';
      } else if (extension === 'webp') {
        contentType = 'image/webp';
      } else {
        contentType = 'application/octet-stream'; // Fallback
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', imageResponse.data.length);
    
    return res.status(200).send(imageResponse.data);

  } catch (error: any) {
    console.error('Error fetching image for download:', error);
    if (axios.isAxiosError(error) && error.response) {
        return res.status(error.response.status || 500).json({ error: `Failed to fetch image: ${error.response.statusText}` });
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch image' });
  }
} 