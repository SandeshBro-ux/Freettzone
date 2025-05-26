import axios, { AxiosError } from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import { JSDOM } from 'jsdom';

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

// Extract video info from SSSTik.net
const extractFromSsstik = async (url: string): Promise<{
  videoId: string, 
  username: string, 
  title: string, 
  thumbnail: string, 
  avatar: string, 
  downloadLinks: any
} | null> => {
  try {
    console.log('Using SSSTik.net for extraction with corrected domain and headers');
    
    const initialResponse = await axios.get('https://sstik.net', { // CORRECTED DOMAIN
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/', // General referer for initial GET
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive'
      }
    });
    
    console.log('Got initial response from SSSTik: Status', initialResponse.status);
    
    let dom = new JSDOM(initialResponse.data);
    let document = dom.window.document;
    
    console.log('Looking for form and token...');
    const formElement = document.querySelector('form#_gcaptcha_pt, form.search-form'); // Added generic form selector
    if (!formElement) {
      console.error('Could not find the form element - site structure may have changed');
      return null;
    }
    
    let ttToken = '';
    // Try different common token input names
    const tokenInputs = ['input[name="tt"]', 'input[name="token"]', 'input[name="_token"]'];
    for (const selector of tokenInputs) {
      const inputElement = formElement.querySelector(selector);
      if (inputElement) {
        ttToken = inputElement.getAttribute('value') || '';
        if (ttToken) {
          console.log('Found tt token from form input:', selector);
          break;
        }
      }
    }
        
    if (!ttToken) {
      console.log('Searching for token in scripts...');
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        const scriptContent = scripts[i].textContent || '';
        const tokenPatterns = [
          /key:\s*['"]([^'"]+)['"]/,
          /tt:\s*['"]([^'"]+)['"]/,
          /token:\s*['"]([^'"]+)['"]/,
          /csrf-token["']?\s*:\s*["']([^"']+)["']/,
          /name="tt"\s+value="([^"]+)"/,
          /"tt",\s*"([^"]+)"/
        ];
        for (const pattern of tokenPatterns) {
          const match = scriptContent.match(pattern);
          if (match && match[1]) {
            ttToken = match[1];
            console.log('Found token in script with pattern:', pattern.toString());
            break;
          }
        }
        if (ttToken) break;
      }
    }
    
    if (!ttToken) {
      console.log('Looking for hidden form inputs with common token names...');
      const allInputs = document.querySelectorAll('input[type="hidden"]');
      allInputs.forEach(input => {
        const inputName = input.getAttribute('name');
        if (inputName && (inputName === 'tt' || inputName.includes('token'))) {
          ttToken = input.getAttribute('value') || '';
          if (ttToken) console.log('Found token in hidden input:', inputName);
        }
      });
    }
    
    if (!ttToken) {
      console.error('Failed to extract token - site may have changed its structure');
      return null;
    }
    
    console.log('Preparing to submit form with TikTok URL...');
    const formData = new URLSearchParams();
    formData.append('id', url); // 'id' is a common parameter name for the URL
    formData.append('locale', 'en');
    formData.append('tt', ttToken); // tt seems to be specific to ssstik, other sites might use 'token' or '_token'
    // Some sites require other parameters, this is a guess
    formData.append('mode', 'download');


    const possibleEndpoints = [
      'https://sstik.net/api/ajaxSearch',       // Actual AJAX endpoint for SSSTik.net
      'https://sstik.net/abc?url=dl', 
      'https://sstik.net/download',    
      'https://sstik.net/api/video',   
      'https://sstik.net/grab',        
      'https://sstik.net/query'        
    ];
    
    let submitResponse = null;
    let endpoint = '';
    
    for (const testEndpoint of possibleEndpoints) {
      try {
        console.log('Trying endpoint:', testEndpoint);
        submitResponse = await axios.post(testEndpoint, formData, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://sstik.net', // CORRECTED DOMAIN
            'Referer': 'https://sstik.net', // CORRECTED DOMAIN
            'X-Requested-With': 'XMLHttpRequest',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
          },
          timeout: 20000 // Increased timeout
        });
        
        if (submitResponse.status === 200 && submitResponse.data) {
          // Check if the response looks like valid HTML or JSON with links
          const responseDataString = typeof submitResponse.data === 'string' ? submitResponse.data : JSON.stringify(submitResponse.data);
          if (responseDataString.includes('download_link') || responseDataString.includes('href') || responseDataString.includes('src')) {
            console.log('Successful response from endpoint:', testEndpoint);
            endpoint = testEndpoint;
            break;
          } else {
            console.log('Endpoint responded but no download links found in preview:', responseDataString.substring(0,200));
          }
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          console.log(`Endpoint ${testEndpoint} failed with AxiosError:`, err.response?.status, err.message);
        } else {
          console.log(`Endpoint ${testEndpoint} failed with non-Axios error:`, String(err));
        }
      }
    }
    
    if (!submitResponse || !endpoint || !submitResponse.data) {
      console.error('All endpoints failed or returned no data - site may be blocking automated access or structure changed.');
      return null;
    }
    
    console.log('Processing response data...');
    
    const resultDom = new JSDOM(submitResponse.data);
    const resultDoc = resultDom.window.document;
    
    const downloadLinks = { hd: '', noWatermark: '', audio: '' };
    let pageTitle = resultDoc.querySelector('title')?.textContent || 'TikTok Video';
    let authorName = 'tiktok_user';
    let videoThumbnail = '';
    let authorAvatar = '';

    // Scrape Author Name
    const authorSelectors = ['.author-name', '.user-info .name', '.content_name', 'h3.username', '.profile-name', '[class*="AuthorName"]'];
    for (const selector of authorSelectors) {
        const element = resultDoc.querySelector(selector);
        if (element && element.textContent) {
            authorName = element.textContent.trim().replace(/^@/, ''); // Remove leading @ if present
            if (authorName) {
                 console.log('Found author name with selector:', selector, `-> ${authorName}`);
                 break;
            }
        }
    }

    // Scrape Video Title / Description
    const titleSelectors = ['.video-title', '.video-description', 'p.desc', '.maintext', 'h2.title', '[class*="VideoTitle"]'];
     for (const selector of titleSelectors) {
        const element = resultDoc.querySelector(selector);
        if (element && element.textContent) {
            pageTitle = element.textContent.trim();
            if (pageTitle) {
                console.log('Found page title with selector:', selector, `-> ${pageTitle}`);
                break;
            }
        }
    }

    // Scrape Video Thumbnail
    const thumbnailSelectors = [
        'img.video-thumbnail', 
        'img.thumbnail', 
        'img[src*="cover"]', 
        'img[src*="thumb"]',
        '.video-player-container img',
        'meta[property="og:image"]' // Fallback to OpenGraph image
    ];
    for (const selector of thumbnailSelectors) {
        const element = resultDoc.querySelector(selector);
        if (element) {
            videoThumbnail = element.getAttribute(selector.startsWith('meta[') ? 'content' : 'src') || '';
            if (videoThumbnail) {
                 // Ensure URL is absolute
                if (videoThumbnail.startsWith('//')) videoThumbnail = 'https:' + videoThumbnail;
                else if (videoThumbnail.startsWith('/') && !videoThumbnail.startsWith('//')) videoThumbnail = 'https://sstik.net' + videoThumbnail; // Adjust domain if needed
                console.log('Found video thumbnail with selector:', selector, `-> ${videoThumbnail}`);
                break;
            }
        }
    }
    
    // Scrape Author Avatar (less common to find, but try)
    const avatarSelectors = ['.author-avatar img', '.user-avatar img', 'img.avatar', 'img[alt*="avatar"]'];
     for (const selector of avatarSelectors) {
        const element = resultDoc.querySelector(selector);
        if (element) {
            authorAvatar = element.getAttribute('src') || '';
            if (authorAvatar) {
                if (authorAvatar.startsWith('//')) authorAvatar = 'https:' + authorAvatar;
                else if (authorAvatar.startsWith('/') && !authorAvatar.startsWith('//')) authorAvatar = 'https://sstik.net' + authorAvatar;
                console.log('Found author avatar with selector:', selector, `-> ${authorAvatar}`);
                break;
            }
        }
    }


    const hdSelectors = [ 'a.download_link.without_watermark_hd', 'a[href*="dl=hd"]', 'a[href*="no_watermark=1"][href*="hd=1"]', 'a:not([href*="watermark"])[href*="720"]', 'a:not([href*="watermark"])[href*="1080"]' ];
    const noWatermarkSelectors = [ 'a.download_link.without_watermark:not(.without_watermark_hd)', 'a[href*="dl=no_wm"]', 'a[href*="no_watermark=1"]:not([href*="hd=1"])', 'a:not([href*="watermark"])' ];
    const audioSelectors = [ 'a.download_link.music', 'a[href*="dl=mp3"]', 'a[href*="type=music"]', 'a[href*="format=mp3"]' ];
    
    for (const selector of hdSelectors) {
      const element = resultDoc.querySelector(selector);
      if (element) {
        downloadLinks.hd = element.getAttribute('href') || '';
        if (downloadLinks.hd) {
          console.log('Found HD link with selector:', selector);
          break;
        }
      }
    }
    
    for (const selector of noWatermarkSelectors) {
      const element = resultDoc.querySelector(selector);
      if (element) {
        downloadLinks.noWatermark = element.getAttribute('href') || '';
        if (downloadLinks.noWatermark) {
          console.log('Found No-Watermark link with selector:', selector);
          break;
        }
      }
    }
    
    for (const selector of audioSelectors) {
      const element = resultDoc.querySelector(selector);
      if (element) {
        downloadLinks.audio = element.getAttribute('href') || '';
        if (downloadLinks.audio) {
          console.log('Found Audio link with selector:', selector);
          break;
        }
      }
    }

     // Fallback to iterate all links if specific selectors fail
    if (!downloadLinks.hd && !downloadLinks.noWatermark && !downloadLinks.audio) {
        console.log('Using fallback link detection for download links...');
        const allLinks = resultDoc.querySelectorAll('a[href]');
        allLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            const text = (link.textContent || '').toLowerCase();
            if (!href.startsWith('http')) return; // Only consider absolute URLs for downloads

            if ((text.includes('hd') || text.includes('720') || text.includes('1080')) && (text.includes('no watermark') || text.includes('without watermark'))) {
                if (!downloadLinks.hd) downloadLinks.hd = href;
            } else if (text.includes('no watermark') || text.includes('without watermark')) {
                if (!downloadLinks.noWatermark) downloadLinks.noWatermark = href;
            } else if (text.includes('mp3') || text.includes('audio')) {
                if (!downloadLinks.audio) downloadLinks.audio = href;
            }
        });
    }
    // Prioritize HD if noWatermark is the same
    if (downloadLinks.hd === downloadLinks.noWatermark && downloadLinks.hd) {
        console.log("HD and NoWatermark links are identical, clearing NoWatermark to prioritize HD.");
        // downloadLinks.noWatermark = ''; // Or keep it, depending on desired behavior
    } else if (!downloadLinks.hd && downloadLinks.noWatermark) {
         console.log("No specific HD link found, using NoWatermark as HD fallback.");
         downloadLinks.hd = downloadLinks.noWatermark; // Use NoWatermark as HD if HD is missing
    }


    if (!downloadLinks.hd && !downloadLinks.noWatermark) {
      console.error('No download links found in response after all attempts.');
      console.log('Response content snippet for manual check:');
      const responseText = submitResponse.data.toString();
      console.log(responseText.substring(0, 500) + '...');
      return null;
    }
    
    let videoId = '';
    const videoIdMatch = url.match(/\/(\d+)(?:\?|$)/);
    if (videoIdMatch && videoIdMatch[1]) videoId = videoIdMatch[1];
    else videoId = `tiktok_${new Date().getTime()}`;
    
    console.log('Successfully extracted data from SSSTik:', { pageTitle, authorName, videoThumbnail, authorAvatar });
    
    return {
      videoId,
      username: authorName,
      title: pageTitle,
      thumbnail: videoThumbnail,
      avatar: authorAvatar,
      downloadLinks
    };
  } catch (error) {
    console.error('Error scraping SSSTik:', error.message);
    if (error.response) {
      console.error('SSSTik Error Response:', error.response.status, error.response.data?.substring(0, 200) + '...');
    }
    return null;
  }
};

// New helper function to extract video ID from various TikTok URL formats
const extractTikTokVideoInfo = async (url: string): Promise<{videoId: string, username: string} | null> => {
  // Clean up URL if needed
  url = url.trim();
  if (url.startsWith('@https://')) {
    url = url.substring(1);
  }
  
  console.log(`Processing TikTok URL: ${url}`);
  
  // 1. Check if it's a direct video URL with pattern
  const directMatch = url.match(/@([^/]+)\/(video|photo)\/(\d+)/i);
  if (directMatch) {
    console.log('Direct TikTok URL match found');
    return {
      username: directMatch[1],
      videoId: directMatch[3]
    };
  }
  
  // 2. For vm.tiktok.com and other short link formats
  if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
    try {
      console.log('Short URL detected, following redirects...');
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        maxRedirects: 10
      });
      
      // If we redirected to a conventional TikTok URL, extract from there
      const finalUrl = response.request?.res?.responseUrl || url;
      console.log(`URL redirected to: ${finalUrl}`);
      
      // Try different patterns for TikTok URLs
      // Standard pattern
      const standardMatch = finalUrl.match(/@([^/]+)\/(video|photo)\/(\d+)/i);
      if (standardMatch) {
        return {
          username: standardMatch[1],
          videoId: standardMatch[3]
        };
      }
      
      // Alternative format with /video/ in different position
      const altMatch = finalUrl.match(/\/(video|photo)\/(\d+)/i);
      if (altMatch) {
        // Try to find username in the URL or default to 'tiktoker'
        const usernameMatch = finalUrl.match(/@([^/?&]+)/i);
        return {
          username: usernameMatch ? usernameMatch[1] : 'tiktoker',
          videoId: altMatch[2]
        };
      }
      
      // If matching the URL failed, try to extract from page content
      const htmlContent = response.data;
      
      // Parse the HTML
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      
      // Try to find canonical URL which might contain the proper format
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink && canonicalLink.getAttribute('href')) {
        const canonicalUrl = canonicalLink.getAttribute('href') || '';
        console.log(`Found canonical URL: ${canonicalUrl}`);
        
        const canonicalMatch = canonicalUrl.match(/@([^/]+)\/(video|photo)\/(\d+)/i);
        if (canonicalMatch) {
          return {
            username: canonicalMatch[1],
            videoId: canonicalMatch[3]
          };
        }
        
        // Try alternative pattern in canonical URL
        const altCanonicalMatch = canonicalUrl.match(/\/(video|photo)\/(\d+)/i);
        if (altCanonicalMatch) {
          const usernameMatch = canonicalUrl.match(/@([^/?&]+)/i);
          return {
            username: usernameMatch ? usernameMatch[1] : 'tiktoker',
            videoId: altCanonicalMatch[2]
          };
        }
      }
      
      // Try meta tags for OpenGraph or other metadata
      let metaVideoId = '';
      let metaUsername = '';
      
      // Check og:url
      const ogUrlMeta = document.querySelector('meta[property="og:url"]');
      if (ogUrlMeta && ogUrlMeta.getAttribute('content')) {
        const ogUrl = ogUrlMeta.getAttribute('content') || '';
        console.log(`Found og:url: ${ogUrl}`);
        
        const ogMatch = ogUrl.match(/@([^/]+)\/(video|photo)\/(\d+)/i) || ogUrl.match(/\/(video|photo)\/(\d+)/i);
        if (ogMatch && ogMatch.length >= 3) {
          metaVideoId = ogMatch.length === 4 ? ogMatch[3] : ogMatch[2];
          if (ogMatch.length === 4) {
            metaUsername = ogMatch[1];
          }
        }
      }
      
      // Check available script tags for data
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        const scriptContent = scripts[i].textContent || '';
        
        // Look for direct mentions of video ID
        let videoIdMatches = [
          scriptContent.match(/["']id["']\s*:\s*["'](\d+)["']/i),
          scriptContent.match(/["']videoId["']\s*:\s*["'](\d+)["']/i),
          scriptContent.match(/["']video_id["']\s*:\s*["'](\d+)["']/i),
          scriptContent.match(/itemId["']?\s*[:=]\s*["']?(\d+)["']?/i),
          scriptContent.match(/video\/(\d+)/i)
        ];
        
        for (const match of videoIdMatches) {
          if (match && match[1] && match[1].length > 5) {  // Video IDs are typically long
            metaVideoId = match[1];
            break;
          }
        }
        
        // Look for username
        let usernameMatches = [
          scriptContent.match(/["']uniqueId["']\s*:\s*["']([^"']+)["']/i),
          scriptContent.match(/["']author["']\s*:\s*[\{\[].*?["']uniqueId["']\s*:\s*["']([^"']+)["']/i),
          scriptContent.match(/authorId["']?\s*[:=]\s*["']?([^"',}]+)["']?/i),
          scriptContent.match(/@([a-zA-Z0-9_.]{3,24})/i)  // Typical TikTok username format
        ];
        
        for (const match of usernameMatches) {
          if (match && match[1]) {
            metaUsername = match[1];
            break;
          }
        }
        
        if (metaVideoId && metaUsername) {
          break; // Stop looking if we found both
        }
      }
      
      // If we found a video ID in metadata
      if (metaVideoId) {
        console.log(`Found video ID from metadata: ${metaVideoId}`);
        return {
          username: metaUsername || 'tiktoker',
          videoId: metaVideoId
        };
      }
    } catch (error) {
      console.error('Error processing TikTok URL:', error.message);
      // Check if it's an Axios error to get more details
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        });
      }

      // Fallback for ECONNRESET or similar network issues where TikTok might block the request
      // or if the URL structure is unexpected after redirects.
      if (error.message.includes('ECONNRESET') || error.code === 'ECONNRESET') {
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
            
            return {
              username: username,
              videoId: videoId,
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
            };
          }
        } catch (innerErr) {
          console.error('Failed alternative approach:', innerErr);
        }
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        return res.status(404).json({ error: 'TikTok video not found (404). It may have been deleted or the URL is incorrect.' });
      }

      return res.status(500).json({ error: 'Failed to extract video information from URL' });
    }
  }
  
  // 3. Last resort: Try to find just a raw video ID
  const plainVideoIdMatch = url.match(/(\d{15,})/);  // TikTok video IDs are typically 15+ digits
  if (plainVideoIdMatch && plainVideoIdMatch[1]) {
    console.log(`Found plain video ID: ${plainVideoIdMatch[1]}`);
    return {
      username: 'unknown',
      videoId: plainVideoIdMatch[1]
    };
  }
  
  console.log('Failed to extract video information from URL');
  return null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const originalInputUrl = req.body.url ? req.body.url.trim() : '';
  const isOriginalUrlShortenerLink = originalInputUrl.includes('vm.tiktok.com/') || originalInputUrl.includes('vt.tiktok.com/');

  if (isOriginalUrlShortenerLink) {
    console.log('Original input URL is a shortener link (vm.tiktok.com or vt.tiktok.com).');
  }

  // Process URL to handle various formats
  let processedUrl = originalInputUrl;
  if (processedUrl.startsWith('@https://')) {
    processedUrl = processedUrl.substring(1);
    console.log(`Removed leading @ from URL: ${processedUrl}`);
  }

  // More permissive URL validation
  if (!processedUrl || 
      (!processedUrl.includes('tiktok.com') && 
       !processedUrl.match(/\d{15,}/) &&  // Raw TikTok video ID (15+ digits)
       !processedUrl.match(/vt\.tiktok\.com/) && 
       !processedUrl.match(/vm\.tiktok\.com/))) {
    return res.status(400).json({ error: 'Please provide a valid TikTok URL or video ID' });
  }

  // Try the new extraction first, especially for vm.tiktok.com links
  try {
    console.log(`Processing TikTok URL: ${processedUrl}`);
    
    // For vm.tiktok.com links, first try SSSTik.net as it's more reliable for these URLs
    if (processedUrl.includes('vm.tiktok.com') || processedUrl.includes('vt.tiktok.com')) {
      console.log('Short TikTok URL detected, trying SSSTik.net first');
      const ssstikResult = await extractFromSsstik(processedUrl);
      
      if (ssstikResult && (ssstikResult.downloadLinks.hd || ssstikResult.downloadLinks.noWatermark)) {
        console.log('Successfully extracted info from SSSTik');
        
        const result = {
          thumbnail: ssstikResult.thumbnail || `https://ui-avatars.com/api/?name=${ssstikResult.username}&background=random&size=720&format=jpeg`,
          title: ssstikResult.title || `TikTok by @${ssstikResult.username}`,
          hashtags: [], // SSSTik doesn't easily provide these
          duration: 0, // SSSTik doesn't easily provide this
          profile: {
            username: ssstikResult.username,
            avatar: ssstikResult.avatar || `https://ui-avatars.com/api/?name=${ssstikResult.username}&background=random&size=128&format=jpeg`
          },
          stats: { /* ... placeholder stats ... */ },
          downloadOptions: {
            proxyUrl: ssstikResult.downloadLinks.hd || ssstikResult.downloadLinks.noWatermark, // Prioritize HD
            altProxyUrl: isOriginalUrlShortenerLink ? '' : (ssstikResult.downloadLinks.noWatermark && ssstikResult.downloadLinks.noWatermark !== ssstikResult.downloadLinks.hd ? ssstikResult.downloadLinks.noWatermark : ''), // Provide non-HD no watermark if different
            audioUrl: ssstikResult.downloadLinks.audio || ''
          }
        };
        return res.status(200).json(result);
      }
      
      // Fallback to the specialized extractor
      console.log('SSSTik extraction failed, reconstructing direct TikTok URL');
      const videoInfo = await extractTikTokVideoInfo(processedUrl);

      if (videoInfo && videoInfo.videoId && videoInfo.username) {
        console.log(`Reconstructed direct URL from short link - VideoID: ${videoInfo.videoId}, Username: ${videoInfo.username}`);
        // Redirect processing to direct TikTok URL
        processedUrl = `https://www.tiktok.com/@${videoInfo.username}/video/${videoInfo.videoId}`;
      } else {
        return res.status(400).json({ error: 'Failed to extract video info from short TikTok URL' });
      }
    }

    // If the specialized extractor didn't work or it's not a vm.tiktok.com link, 
    // continue with the original implementation
    // This pattern will be used to validate the *final* URL after redirects
    const finalUrlPattern = /@([^/]+)\/(video|photo)\/(\d+)/i;

    console.log(`Fetching TikTok data from initial URL: ${processedUrl}`);
    
    const response = await axios.get(processedUrl, {
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
    const finalUrl = response.request?.res?.responseUrl || response.config.url || processedUrl;
    console.log(`Final URL after redirects: ${finalUrl}`);

    // Validate the final URL structure
    const finalUrlMatch = finalUrl.match(finalUrlPattern);
    if (!finalUrlMatch) {
      return res.status(400).json({ error: 'Invalid TikTok video/photo URL structure after redirect. Please use a direct link to a video or photo.' });
    }
    
    const usernameFromFinalUrl = finalUrlMatch[1];
    const videoIdFromFinalUrl = finalUrlMatch[3];
    
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
    
    if (!username) { // If JSON didn't provide username, try to get it from the final URL
      username = usernameFromFinalUrl;
    }
    
    // If we still couldn't extract hashtags, try from the title
    if (hashtags.length === 0 && title) {
      hashtags = extractHashtags(title);
    }
    
    // Build result with all extracted information
    const result = {
      thumbnail: thumbnail || 'https://placehold.co/600x800/fe2c55/ffffff?text=TikTok+Content',
      title: title || `Content by @${username}`,
      hashtags: hashtags,
      duration: 0, // Placeholder, consider extracting if available
      profile: {
        username: username || 'N/A',
        avatar: avatar || `https://ui-avatars.com/api/?name=${username}&background=random&size=128`
      },
      stats: {
        likes: likes || 0,
        comments: comments || 0,
        bookmarks: bookmarks || 0,
        views: views || 0
      },
      downloadOptions: {
        proxyUrl: `/api/tiktok-video-download/${encodeURIComponent(videoIdFromFinalUrl)}/Freetiktokzone_HD.mp4?username=${encodeURIComponent(usernameFromFinalUrl)}`,
        altProxyUrl: isOriginalUrlShortenerLink ? '' : `/api/tiktok-video-download/${encodeURIComponent(videoIdFromFinalUrl)}/Freetiktokzone_SD.mp4?username=${encodeURIComponent(usernameFromFinalUrl)}&pref_source=alt1&watermark=true`,
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
        const videoIdMatch = processedUrl.match(/\/video\/(\d+)/);
        const usernameMatch = processedUrl.match(/@([^\/]+)/);
        
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
              altProxyUrl: isOriginalUrlShortenerLink ? '' : `/api/tiktok-video-download/${encodeURIComponent(videoId)}/Freetiktokzone_SD.mp4?username=${encodeURIComponent(username)}&pref_source=alt1` 
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