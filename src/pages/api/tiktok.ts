import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

// Helper function to extract hashtags from a string
const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  const regex = /#(\w+)/g;
  const matches = text.match(regex);
  return matches ? matches.map(tag => tag.substring(1)) : [];
};

interface TikTokData {
  thumbnail: string;
  alternateThumbnails?: string[];
  title: string;
  hashtags: string[];
  duration: number;
  profile: {
    username: string;
    avatar: string;
  };
  stats?: {
    likes: number;
    comments: number;
    bookmarks: number;
    views: number;
  };
  downloadOptions?: {
    videoUrl?: string;
    hdVideoUrl?: string;
    watermarkFreeUrl?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { url } = req.body;

  // Validate that the URL is a TikTok URL
  if (!url || !url.includes('tiktok.com')) {
    return res.status(400).json({ error: 'Only TikTok URLs are supported' });
  }

  // Validate URL format more specifically for TikTok videos and photos
  const tiktokPattern = /^https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/(video|photo)\/\d+(\?[^/]*)?$/i;
  if (!tiktokPattern.test(url)) {
    return res.status(400).json({ error: 'Invalid TikTok URL format. Please use a valid video or photo URL.' });
  }

  try {
    console.log(`Fetching TikTok data from URL: ${url}`);
    
    // TikTok has anti-scraping measures, so we need to pretend to be a legitimate browser
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
      },
      timeout: 15000, // 15 seconds timeout
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 300; // default
      }
    });

    const htmlContent = response.data;
    
    let jsonData = null;
    
    // Extract data from JSON if available
    let title = '';
    let thumbnail = '';
    let hashtags: string[] = [];
    let username = '';
    let avatar = '';
    let likes = 0;
    let comments = 0;
    let bookmarks = 0;
    let views = 0;
    let videoUrl = '';
    let hdVideoUrl = '';
    
    // Look for JSON data in script tags - this is often where metadata is stored
    const scriptRegex = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.+?)<\/script>/;
    const scriptMatch = htmlContent.match(scriptRegex);
    
    if (scriptMatch && scriptMatch[1]) {
      try {
        jsonData = JSON.parse(scriptMatch[1]);
        console.log("Found embedded JSON data");
        
        // Direct path to video metadata in TikTok JSON structure
        if (jsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct) {
          const videoData = jsonData.__DEFAULT_SCOPE__['webapp.video-detail'].itemInfo.itemStruct;
          console.log("Found video data structure");
          
          // Extract video thumbnail directly from video URLs
          if (videoData.video?.cover) {
            thumbnail = videoData.video.cover;
            console.log("Found direct video thumbnail:", thumbnail);
          }
          
          // Extract video download URLs
          if (videoData.video?.playAddr) {
            videoUrl = videoData.video.playAddr;
            console.log("Found video URL:", videoUrl);
          }
          
          if (videoData.video?.downloadAddr) {
            hdVideoUrl = videoData.video.downloadAddr;
            console.log("Found HD video URL:", hdVideoUrl);
          } else if (videoData.video?.playAddr) {
            // Use playAddr as fallback for HD
            hdVideoUrl = videoData.video.playAddr;
          }
          
          // Get title from description
          if (videoData.desc) {
            title = videoData.desc;
            console.log("Found video title/description:", title);
          }
          
          // Get username
          if (videoData.author?.uniqueId) {
            username = videoData.author.uniqueId;
          }
          
          // Get avatar
          if (videoData.author?.avatarLarger) {
            avatar = videoData.author.avatarLarger;
          }
          
          // Extract stats
          if (videoData.stats) {
            likes = parseInt(videoData.stats.diggCount) || 0;
            comments = parseInt(videoData.stats.commentCount) || 0;
            bookmarks = parseInt(videoData.stats.collectCount) || 0;
            views = parseInt(videoData.stats.playCount) || 0;
            console.log("Found stats - Likes:", likes, "Comments:", comments, "Bookmarks:", bookmarks, "Views:", views);
          }
          
          // Extract hashtags from textExtra
          if (videoData.textExtra) {
            videoData.textExtra.forEach((extra: any) => {
              if (extra.hashtagName) {
                hashtags.push(extra.hashtagName);
              }
            });
          }
        }
        if (jsonData.__DEFAULT_SCOPE__) {
          console.log("DEFAULT_SCOPE keys:", Object.keys(jsonData.__DEFAULT_SCOPE__));
        }
      } catch (e) {
        console.log("Found script but failed to parse JSON");
      }
    }
    
    if (jsonData && jsonData.routeData && jsonData.routeData.photoDetail) {
      const photoData = jsonData.routeData.photoDetail;
      title = photoData?.title || '';
      thumbnail = photoData?.cover || '';
      username = photoData?.authorInfo?.uniqueId || '';
      avatar = photoData?.authorInfo?.avatarLarger || '';
      
      // Try to extract hashtags from challenges data if available
      if (photoData?.challenges) {
        hashtags = photoData.challenges.map((challenge: any) => challenge.title || '');
      }
    }
    
    // Fallback to meta tags if JSON data extraction failed
    if (!title) {
      const titleMatch = htmlContent.match(/<meta name="description" content="([^"]+)"/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
      }
      
      // Try another common location for title
      if (!title) {
        const ogTitleMatch = htmlContent.match(/<meta property="og:title" content="([^"]+)"/);
        if (ogTitleMatch && ogTitleMatch[1]) {
          title = ogTitleMatch[1];
        }
      }
    }
    
    if (!thumbnail) {
      const thumbnailMatch = htmlContent.match(/<meta property="og:image" content="([^"]+)"/);
      if (thumbnailMatch && thumbnailMatch[1]) {
        const rawUrl = thumbnailMatch[1];
        thumbnail = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
        console.log("Found thumbnail from og:image:", thumbnail);
      }
    }
    
    if (!username) {
      const usernameMatch = url.match(/@([^\/]+)/);
      if (usernameMatch && usernameMatch[1]) {
        username = usernameMatch[1];
      }
    }
    
    // If we still couldn't extract hashtags, try from the title
    if (hashtags.length === 0 && title) {
      hashtags = extractHashtags(title);
    }
    
    // Build result with all extracted information
    const videoIdFromUrl = url.match(/\/video\/(\d+)/)?.[1] || '';
    const usernameFromUrl = username || '';

    const result = {
      thumbnail: thumbnail || 'https://placehold.co/600x800/fe2c55/ffffff?text=TikTok+Content',
      title: title || `Video by @${usernameFromUrl}`,
      hashtags: hashtags,
      duration: 0, // Photos don't have duration
      profile: {
        username: usernameFromUrl || 'N/A',
        avatar: avatar || `https://ui-avatars.com/api/?name=${usernameFromUrl}&background=random&size=128`
      },
      stats: {
        likes: likes || 0,
        comments: comments || 0,
        bookmarks: bookmarks || 0,
        views: views || 0
      },
      downloadOptions: {
        // For "Download (No Watermark)" button
        proxyUrl: `/api/tiktok-video-download/${encodeURIComponent(videoIdFromUrl)}/Freetiktokzone_HD.mp4?username=${encodeURIComponent(usernameFromUrl)}`,
        
        // For "Download SD" button - now with watermark option
        altProxyUrl: `/api/tiktok-video-download/${encodeURIComponent(videoIdFromUrl)}/Freetiktokzone_SD.mp4?username=${encodeURIComponent(usernameFromUrl)}&pref_source=alt1&watermark=true`,
        
        // Original download URLs (if available directly from TikTok)
        videoUrl: videoUrl || '',
        hdVideoUrl: hdVideoUrl || ''
      }
    };

    console.log("Extracted data:", {
      title: result.title,
      thumbnail: result.thumbnail,
      hashtags: result.hashtags,
      username: result.profile.username,
      avatar: result.profile.avatar
    });

    if (!result.profile.username || !result.thumbnail) {
      throw new Error('Incomplete data from TikTok');
    }

    console.log('Successfully extracted data from __UNIVERSAL_DATA_FOR_REHYDRATION__');
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('API Error:', err);
    // Check for ECONNRESET specifically
    if (err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET')) {
      console.log('Connection reset error - trying alternative approach');
      
      try {
        // Extract video ID from URL for direct CDN access
        const videoIdMatch = url.match(/\/video\/(\d+)/);
        const usernameMatch = url.match(/@([^\/]+)/);
        
        if (videoIdMatch && videoIdMatch[1] && usernameMatch && usernameMatch[1]) {
          const videoId = videoIdMatch[1];
          const username = usernameMatch[1];
          
          // Use video ID to construct thumbnail URL directly (this is TikTok's CDN pattern)
          // We use multiple possible CDN domains to increase chances of success
          const thumbnailOptions = [
            `https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/videos/tos/useast5/tos-useast5-pve-0068-tx/o0koLsADzQHxkQjNAMrPy/${videoId}~tplv-tx-video.jpeg`,
            `https://p19-sign.tiktokcdn-us.com/obj/tos-useast5-p-0068-tx/${videoId}~c5_720x720.jpeg`,
            `https://p16-sign.tiktokcdn-us.com/obj/tos-maliva-p-0068/${videoId}~c5_720x720.jpeg`,
            `https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/${videoId}~c5_720x720.jpeg`
          ];
          
          res.status(200).json({
            thumbnail: thumbnailOptions[0],
            alternateThumbnails: thumbnailOptions,
            title: `TikTok by @${username}`,
            hashtags: [],
            duration: 0,
            profile: {
              username: username,
              avatar: `https://ui-avatars.com/api/?name=${username}&background=random&size=128`
            },
            stats: {
              likes: 0,
              comments: 0,
              bookmarks: 0,
              views: 0
            },
            downloadOptions: {
              proxyUrl: `/api/tiktok-video-download/${encodeURIComponent(videoId)}/Freetiktokzone_HD.mp4?username=${encodeURIComponent(username)}`,
              altProxyUrl: `/api/tiktok-video-download/${encodeURIComponent(videoId)}/Freetiktokzone_SD.mp4?username=${encodeURIComponent(username)}&pref_source=alt1` 
            }
          });
          return;
        }
      } catch (innerErr) {
        console.error('Failed alternative approach:', innerErr);
      }
    }
    const statusCode = err.message.includes('404') ? 404 : 500;
    res.status(statusCode).json({ 
      error: err.message || 'Failed to fetch TikTok data' 
    });
  }
} 