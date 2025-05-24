import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Helper functions (downloadFromSaveTT, downloadFromSnapTik, downloadFromTikWM) 
// will be defined below the main handler, identical to their versions in proxy-download.ts
// but with a modification to use the dynamic filename from the route for Content-Disposition.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { videoId, filename, username, quality, pref_source, watermark } = req.query;

  if (!videoId || typeof videoId !== 'string') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(400).send('Error: Missing video ID');
  }
  if (!filename || typeof filename !== 'string') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(400).send('Error: Missing filename for download');
  }

  try {
    console.log(`Processing download for TikTok video: ${videoId}, Filename: ${filename}, Preferred Source: ${pref_source || 'default (TikWM first)'}, Watermark: ${watermark || 'false'}`);
    // Construct username from filename if not provided, or use a default
    const derivedUsername = username || (filename.includes('_') ? filename.split('_')[0] : 'user');
    const tikTokUrl = `https://www.tiktok.com/@${derivedUsername}/video/${videoId}`;
    console.log(`Original TikTok URL: ${tikTokUrl}`);

    // If watermark parameter is present and truthy, use the watermarked download service
    if (watermark === 'true') {
      console.log('Watermarked video requested. Trying TikSave first...');
      try {
        await downloadWatermarkedVideo(tikTokUrl, res, filename);
        console.log('Watermarked download successful.');
        return;
      } catch (watermarkError: any) {
        console.error(`Watermarked download failed: ${watermarkError.message}.`);
        console.log('Falling back to standard download services...');
      }
    }

    if (pref_source === 'alt1') {
      console.log('Preferred source: alt1. Trying SaveTT first...');
      try {
        await downloadFromSaveTT(tikTokUrl, res, filename, 'sd');
        console.log('SaveTT download successful.');
        return;
      } catch (error1: any) {
        console.error(`SaveTT (alt1) failed: ${error1.message}.`);
        console.log('SaveTT (alt1) failed, trying SnapTik...');
      }
      try {
        await downloadFromSnapTik(tikTokUrl, res, filename, 'sd');
        console.log('SnapTik download successful.');
        return;
      } catch (error2: any) {
        console.error(`SnapTik (alt1) failed: ${error2.message}.`);
        console.log('SnapTik (alt1) failed, falling back to TikWM...');
      }
    }

    try {
      console.log('Attempting download with TikWM (default/fallback)...');
      await downloadFromTikWM(tikTokUrl, res, filename, quality as string | undefined);
      console.log('TikWM download successful.');
      return;
    } catch (errorTikWM: any) {
      console.error(`TikWM download failed: ${errorTikWM.message}.`);
      if (pref_source === 'alt1') {
        console.log('All services (including TikWM fallback) failed for alt1 video request:', tikTokUrl);
        res.setHeader('Content-Type', 'text/plain');
        return res.status(500).send('Error: Could not download video using alternative sources.');
      }
      console.log('TikWM failed, trying SaveTT as fallback...');
    }

    try {
      console.log('Attempting download with SaveTT (fallback)...');
      await downloadFromSaveTT(tikTokUrl, res, filename);
      console.log('SaveTT download successful (fallback).');
      return;
    } catch (errorSaveTT: any) {
      console.error(`SaveTT (fallback) failed: ${errorSaveTT.message}.`);
      console.log('SaveTT (fallback) failed, trying SnapTik (fallback)...');
    }

    try {
      console.log('Attempting download with SnapTik (fallback)...');
      await downloadFromSnapTik(tikTokUrl, res, filename);
      console.log('SnapTik download successful (fallback).');
      return;
    } catch (errorSnapTik: any) {
      console.error(`SnapTik (fallback) failed: ${errorSnapTik.message}.`);
      console.log('All download services failed for video:', tikTokUrl);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(500).send('Error: All video download services failed. Please try again later.');
    }

  } catch (error: any) { // Catch any unexpected errors from the try block itself
    console.error('Generic error in download handler:', error.message);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send('Error: An unexpected error occurred while processing your download request.');
  }
}

// New function to download watermarked video
async function downloadWatermarkedVideo(videoUrl: string, res: NextApiResponse, suggestedFilename: string) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Method 1: Prioritize tiktokio.com for "Download with Watermark"
  try {
    console.log('Watermarked Download - Method 1: Attempting tiktokio.com for watermarked video...');
    
    // Step 1: POST to tiktokio.com to get the download page
    // Their frontend seems to POST to an API endpoint, let's try to mimic that or find a simpler POST target.
    // From inspecting their site, they make a POST request to https://tiktokio.com/api/v1/tk/quotes with `link` in the body.
    const tiktokioApiUrl = 'https://tiktokio.com/api/v1/tk/quotes';
    let initialApiResponse;
    try {
        initialApiResponse = await axios.post(tiktokioApiUrl, 
            { link: videoUrl }, // Sending as JSON body
            {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json;charset=utf-8',
                    'Origin': 'https://tiktokio.com',
                    'Referer': 'https://tiktokio.com/',
                },
                timeout: 15000
            }
        );
    } catch (apiError: any) {
        // If the API endpoint fails, try submitting to the main page form as a fallback for tiktokio
        console.warn('tiktokio.com API endpoint failed, trying main page form submission...');
        const mainPageFormData = new URLSearchParams();
        mainPageFormData.append('query', videoUrl); // 'query' seems to be the input name on their main page
        initialApiResponse = await axios.post('https://tiktokio.com/', mainPageFormData, {
             headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://tiktokio.com',
                'Referer': 'https://tiktokio.com/'
            },
            timeout: 15000
        });
    }

    const responseData = initialApiResponse.data;
    let htmlToParse = '';

    if (typeof responseData === 'string') {
        htmlToParse = responseData; // If it's HTML directly
    } else if (typeof responseData === 'object' && responseData.data && responseData.data.html) {
        htmlToParse = responseData.data.html; // If it's JSON with HTML content
    } else if (typeof responseData === 'object' && responseData.links) { // Direct JSON response with links
        const watermarkedLinkEntry = responseData.links.find((linkEntry: any) => linkEntry.type === 'watermark');
        if (watermarkedLinkEntry && watermarkedLinkEntry.href) {
            const directWatermarkedUrl = watermarkedLinkEntry.href;
             console.log('Watermarked Download - Method 1: Found direct watermarked link from tiktokio JSON response:', directWatermarkedUrl);
            const videoResponse = await axios.get(directWatermarkedUrl, {
                responseType: 'stream',
                headers: { 'User-Agent': userAgent, 'Referer': 'https://tiktokio.com/' },
                timeout: 25000
            });
            if (videoResponse.status === 200) {
                if (videoResponse.headers['content-length']) res.setHeader('Content-Length', videoResponse.headers['content-length']);
                res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
                videoResponse.data.pipe(res);
                return; // Success
            }
        }
    }

    if (!htmlToParse) {
        console.error('Watermarked Download - Method 1: tiktokio.com did not return parsable HTML or expected JSON structure. Response data:', JSON.stringify(responseData).substring(0,500));
        throw new Error('tiktokio.com did not return expected content.');
    }

    // Step 2: Parse the HTML to find the "Download with Watermark" link
    // Based on typical structures and the image: look for an <a> tag containing "Download with Watermark"
    // Example selector: a:contains("Download with Watermark") or a button/link with a specific class/ID.
    // Let's try a regex that's more flexible.
    // The regex looks for an <a> tag with an href, and the text "Download with Watermark" or similar variations.
    const watermarkedLinkRegex = /<a\s+(?:[^>]*?\s+)?href=\"([^\"]+)\"[^>]*?>[^<]*?(Download with Watermark|Download Watermark|Watermarked Video|Video Watermark)[^<]*?<\/a>/i;
    const match = htmlToParse.match(watermarkedLinkRegex);

    if (match && match[1]) {
      let watermarkedUrl = match[1];
      // Ensure the URL is absolute
      if (watermarkedUrl.startsWith('/')) {
        watermarkedUrl = 'https://tiktokio.com' + watermarkedUrl;
      }
      console.log('Watermarked Download - Method 1: Found watermarked link from tiktokio.com HTML:', watermarkedUrl);

      const videoResponse = await axios.get(watermarkedUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': userAgent,
          'Referer': 'https://tiktokio.com/' // Referer as tiktokio.com
        },
        timeout: 25000
      });

      if (videoResponse.status === 200) {
        if (videoResponse.headers['content-length']) {
          res.setHeader('Content-Length', videoResponse.headers['content-length']);
        }
        res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
        videoResponse.data.pipe(res);
        console.log('Watermarked Download - Method 1: Successfully streamed from tiktokio.com.');
        return; // Success
      } else {
        console.warn('Watermarked Download - Method 1: tiktokio.com watermarked URL returned status:', videoResponse.status);
        throw new Error(`tiktokio.com returned status ${videoResponse.status} for watermarked link.`);
      }
    } else {
      console.error('Watermarked Download - Method 1: Could not find a "Download with Watermark" link on tiktokio.com. HTML snippet:', htmlToParse.substring(0, 1000));
      throw new Error('Could not find watermarked download link on tiktokio.com page.');
    }
  } catch (error: any) {
    console.error('Watermarked Download - Method 1 (tiktokio.com) failed:', error.message);
    // Fall through to the next method if tiktokio.com fails
  }

  // Method 2: Try to get direct TikTok source (with watermark) - Fallback
  try {
    console.log('Watermarked Download - Method 2 (Fallback): Attempting to get original TikTok source video with watermark...');
    const tiktokPageResponse = await axios.get(videoUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
      },
      timeout: 15000
    });

    const htmlContent = tiktokPageResponse.data;
    const scriptRegex = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.+?)<\/script>/;
    const scriptMatch = htmlContent.match(scriptRegex);

    if (scriptMatch && scriptMatch[1]) {
      const jsonData = JSON.parse(scriptMatch[1]);
      if (jsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct?.video) {
        const videoData = jsonData.__DEFAULT_SCOPE__['webapp.video-detail'].itemInfo.itemStruct.video;
        const originalTikTokUrl = videoData.downloadAddr || videoData.playAddr;

        if (originalTikTokUrl) {
          console.log('Watermarked Download - Method 2 (Fallback): Found TikTok original source URL (assumed watermarked):', originalTikTokUrl);
          const videoResponse = await axios.get(originalTikTokUrl, {
            responseType: 'stream',
            headers: { 'User-Agent': userAgent, 'Referer': videoUrl },
            timeout: 25000
          });
          if (videoResponse.status === 200) {
            if (videoResponse.headers['content-length']) res.setHeader('Content-Length', videoResponse.headers['content-length']);
            res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
            videoResponse.data.pipe(res);
            return; // Success
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Watermarked Download - Method 2 (Direct TikTok Fallback) failed:', error.message);
  }

  // Method 3: Try TikWM API for its explicit watermarked version (wmplay) - Fallback
  try {
    console.log('Watermarked Download - Method 3 (Fallback): Attempting TikWM API for wmplay URL...');
    const formData = new URLSearchParams();
    formData.append('url', videoUrl);
    const tikwmApiResponse = await axios.post('https://www.tikwm.com/api/', formData, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://www.tikwm.com',
        'Referer': 'https://www.tikwm.com/'
      },
      timeout: 15000
    });

    if (tikwmApiResponse.data?.code === 0 && tikwmApiResponse.data?.data?.wmplay) {
      const wmPlayUrl = tikwmApiResponse.data.data.wmplay;
      console.log('Watermarked Download - Method 3 (Fallback): TikWM API returned wmplay URL:', wmPlayUrl);
      const finalWmDownloadLink = wmPlayUrl.startsWith('http') ? wmPlayUrl : `https://www.tikwm.com${wmPlayUrl}`;
      const videoResponse = await axios.get(finalWmDownloadLink, {
        responseType: 'stream',
        headers: { 'User-Agent': userAgent, 'Referer': 'https://www.tikwm.com/' },
        timeout: 25000
      });
      if (videoResponse.status === 200) {
        if (videoResponse.headers['content-length']) res.setHeader('Content-Length', videoResponse.headers['content-length']);
        res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
        videoResponse.data.pipe(res);
        return; // Success
      }
    }
  } catch (error: any) {
    console.error('Watermarked Download - Method 3 (TikWM API Fallback) failed:', error.message);
  }
  
  console.error('Watermarked Download: All methods failed to retrieve a watermarked video.');
  throw new Error('Could not retrieve a watermarked version of the video after trying all available methods.');
}

// --- Helper Download Functions (adapted for dynamic filename) ---

async function downloadFromSaveTT(videoUrl: string, res: NextApiResponse, suggestedFilename: string, typeHint?: string) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  let htmlContent = ''; 
  try {
    console.log('SaveTT: Fetching initial page...');
    const initialResponse = await axios.get('https://savett.cc/en', {
      headers: { 'User-Agent': userAgent, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5', 'Referer': 'https://www.google.com/' }, timeout: 8000
    });
    htmlContent = initialResponse.data;
    console.log('SaveTT: Initial page fetched. Extracting token...');
    const tokenMatch = htmlContent.match(/name="_token".*?value="(.*?)"/);
    if (!tokenMatch || !tokenMatch[1]) {
      throw new Error('SaveTT: Failed to extract _token.');
    }
    const token = tokenMatch[1];
    console.log('SaveTT: Obtained _token.');
    const formData = new URLSearchParams();
    formData.append('url', videoUrl); formData.append('_token', token);
    console.log('SaveTT: Submitting URL for download link...');
    const downloadResponse = await axios.post('https://savett.cc/en/download', formData, {
      headers: { 'User-Agent': userAgent, 'Accept': 'text/html', 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://savett.cc', 'Referer': 'https://savett.cc/en' }, timeout: 12000
    });
    htmlContent = downloadResponse.data;
    console.log('SaveTT: Download page response received. Extracting download link...');
    const downloadLinkMatch = htmlContent.match(/href="(https:\/\/[^"]+\.mp4[^"]*?)"/);
    if (!downloadLinkMatch || !downloadLinkMatch[1]) {
      throw new Error('SaveTT: Failed to extract MP4 download link.');
    }
    const downloadLink = downloadLinkMatch[1];
    console.log('SaveTT: Extracted MP4 download link:', downloadLink);
    console.log('SaveTT: Streaming video...');
    const videoResponse = await axios.get(downloadLink, { responseType: 'stream', headers: { 'User-Agent': userAgent, 'Referer': 'https://savett.cc/' }, timeout: 20000 });
    if (videoResponse.headers['content-length']) {
      res.setHeader('Content-Length', videoResponse.headers['content-length']);
    }
    res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
    videoResponse.data.pipe(res);
  } catch (e: any) {
    let errorMessage = `SaveTT Error: ${e.message}`;
    if (axios.isAxiosError(e) && e.response) errorMessage += ` (Status: ${e.response.status})`;
    else if (axios.isAxiosError(e) && e.request) errorMessage += ' (No response received)';
    throw new Error(errorMessage, { cause: e });
  }
}

async function downloadFromSnapTik(videoUrl: string, res: NextApiResponse, suggestedFilename: string, typeHint?: string) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  let responseContent = ''; 
  try {
    console.log('SnapTik: Submitting URL...');
    const formData = new URLSearchParams(); formData.append('url', videoUrl);
    const downloadResponse = await axios.post('https://snaptik.app/abc.php', formData, {
      headers: { 'User-Agent': userAgent, 'Accept': 'text/html', 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://snaptik.app', 'Referer': 'https://snaptik.app/', 'X-Requested-With': 'XMLHttpRequest' }, timeout: 12000
    });
    responseContent = typeof downloadResponse.data === 'string' ? downloadResponse.data : JSON.stringify(downloadResponse.data);
    console.log('SnapTik: Response received. Extracting download link...');
    let downloadLink;
    const data = downloadResponse.data;
    if (typeof data === 'string') {
        const directMp4Match = data.match(/href="(https?:\/\/[^"\s]+\.mp4[^"\s]*)"/i);
        if (directMp4Match && directMp4Match[1]) {
            downloadLink = directMp4Match[1];
        } else {
            const regexPattern = 'value=\"(https?:\\\\/\\\\/tikcdn[^\"\\]+)'; 
            const tokenizedLinkMatch = data.match(new RegExp(regexPattern, 'i'));
            if (tokenizedLinkMatch && tokenizedLinkMatch[1]) {
                 console.warn('SnapTik: Found a tokenized link:', tokenizedLinkMatch[1]);
            }        
        }
    } else if (typeof data === 'object' && data.links && Array.isArray(data.links) && data.links.length > 0) {
      const mp4Link = data.links.find((l: any) => l.url && typeof l.url ==='string' && l.url.includes('.mp4'));
      if (mp4Link) downloadLink = mp4Link.url;
      else downloadLink = data.links[0].url || data.links[0].v_download; 
    }
    if (!downloadLink) {
      throw new Error('SnapTik: Failed to extract MP4 download link.');
    }
    console.log('SnapTik: Extracted download link:', downloadLink);
    console.log('SnapTik: Streaming video...');
    const videoResponse = await axios.get(downloadLink, { responseType: 'stream', headers: { 'User-Agent': userAgent, 'Referer': 'https://snaptik.app/' }, timeout: 20000 });
    if (videoResponse.headers['content-length']) {
      res.setHeader('Content-Length', videoResponse.headers['content-length']);
    }
    res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`);
    videoResponse.data.pipe(res);
  } catch (e: any) {
    let errorMessage = `SnapTik Error: ${e.message}`;
    if (axios.isAxiosError(e) && e.response) errorMessage += ` (Status: ${e.response.status})`;
    else if (axios.isAxiosError(e) && e.request) errorMessage += ' (No response received)';
    throw new Error(errorMessage, { cause: e });
  }
}

async function downloadFromTikWM(videoUrl: string, res: NextApiResponse, suggestedFilename: string, qualityHint?: string) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  let apiResponseJson = '';
  try {
    console.log(`TikWM: Submitting URL for ${qualityHint || 'default'} quality...`);
    const formData = new URLSearchParams();
    formData.append('url', videoUrl);
    if (qualityHint === 'sd_placeholder' || qualityHint === 'sd') {
      formData.append('hd', '0'); 
      console.log('TikWM: Requesting SD quality (hd=0)');
    } else {
      formData.append('hd', '1'); 
    }
    const apiResponse = await axios.post('https://www.tikwm.com/api/', formData, {
      headers: { 'User-Agent': userAgent, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Origin': 'https://www.tikwm.com', 'Referer': 'https://www.tikwm.com/'},
      timeout: 15000
    });
    apiResponseJson = JSON.stringify(apiResponse.data);
    console.log('TikWM: API response received.');
    if (apiResponse.data && apiResponse.data.code === 0 && apiResponse.data.data && apiResponse.data.data.play) {
      let downloadLink = apiResponse.data.data.play;
      if ((qualityHint === 'sd_placeholder' || qualityHint === 'sd') && apiResponse.data.data.sdplay) { 
        downloadLink = apiResponse.data.data.sdplay;
        console.log('TikWM: Using explicit SD link (sdplay):', downloadLink);
      } else {
        console.log('TikWM: Using primary play link:', downloadLink);
      }
      const finalDownloadLink = downloadLink.startsWith('http') ? downloadLink : `https://www.tikwm.com${downloadLink}`;
      console.log('TikWM: Streaming video from:', finalDownloadLink);
      const videoResponse = await axios.get(finalDownloadLink, {
        responseType: 'stream',
        headers: { 'User-Agent': userAgent, 'Referer': 'https://www.tikwm.com/' },
        timeout: 25000
      });
      if (videoResponse.headers['content-length']) {
        res.setHeader('Content-Length', videoResponse.headers['content-length']);
      }
      res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${suggestedFilename}"`); 
      videoResponse.data.pipe(res);
    } else {
      let failureReason = 'API format error or video not found.';
      if (apiResponse.data && apiResponse.data.msg) failureReason = apiResponse.data.msg;
      console.error('TikWM: Download link extraction failed. Response:', apiResponseJson);
      throw new Error(`TikWM: ${failureReason}`);
    }
  } catch (e: any) {
    let errorMessage = `TikWM Error: ${e.message}`;
    if (axios.isAxiosError(e) && e.response) {
      errorMessage += ` (Status: ${e.response.status} - ${e.response.statusText})`;
      console.error('TikWM Axios error response:', String(e.response?.data).substring(0,500));
    } else if (axios.isAxiosError(e) && e.request) {
      errorMessage += ' (No response received)';
    }
    console.error('TikWM API response during error:', apiResponseJson);
    throw new Error(errorMessage, { cause: e });
  }
} 