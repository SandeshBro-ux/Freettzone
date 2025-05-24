import { useState } from 'react';
import axios from 'axios';
import styles from './TikTokFetcher.module.css';

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
    proxyUrl?: string;        // For the primary "Download (No Watermark)" button (uses TikWM first)
    altProxyUrl?: string;   // For the "Download SD" button (tries SaveTT/SnapTik first)
  };
}

export default function TikTokFetcher() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<TikTokData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidTikTokUrl = (url: string) => {
    // Support standard TikTok URLs as well as those with query parameters
    return /^https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/(video|photo)\/\d+(\?[^/]*)?$/i.test(url);
  };

  const fetchData = async () => {
    if (!url) {
      setError('Please enter a TikTok URL.');
      return;
    }
    
    if (!isValidTikTokUrl(url)) {
      setError('Invalid TikTok URL. Please enter a valid TikTok video or photo URL. Example: https://www.tiktok.com/@username/video/1234567890');
      return;
    }
    
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const response = await axios.post('/api/tiktok', { url });
      setData(response.data);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch TikTok data. Please check the URL and try again.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchData();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchContainer}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter TikTok URL"
            className={styles.input}
            disabled={loading}
          />
          <button 
            onClick={fetchData} 
            disabled={loading} 
            className={styles.button}
          >
            {loading ? (
              <div className={styles.loaderContainer}>
                <div className={styles.loader}></div>
              </div>
            ) : (
              'Get Info'
            )}
          </button>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <svg viewBox="0 0 24 24" className={styles.errorIcon}>
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {data && (
        <div className={styles.resultContainer}>
          <div className={styles.headerSection}>
            <div className={styles.profileSection}>
              <img 
                src={data.profile.avatar} 
                alt={`${data.profile.username}'s profile`} 
                className={styles.avatar}
              />
              <div className={styles.usernameContainer}>
                <span className={styles.usernameLabel}>Creator</span>
                <h3 className={styles.username}>@{data.profile.username}</h3>
              </div>
            </div>
          </div>

          <div className={styles.mediaContainer}>
            <img 
              src={data.thumbnail} 
              alt="Content thumbnail" 
              className={styles.thumbnail}
              onError={(e) => {
                console.log("Image error loading:", data.thumbnail);
                if (data.alternateThumbnails && data.alternateThumbnails.length > 0) {
                  const currentSrc = (e.target as HTMLImageElement).src;
                  const currentIndex = data.alternateThumbnails.findIndex(url => url === currentSrc);
                  
                  if (currentIndex === -1 && data.alternateThumbnails[0] !== data.thumbnail) {
                    (e.target as HTMLImageElement).src = data.alternateThumbnails[0];
                  } else if (currentIndex < data.alternateThumbnails.length - 1) {
                    (e.target as HTMLImageElement).src = data.alternateThumbnails[currentIndex + 1];
                  } else {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect width='600' height='800' fill='%23fe2c55'/%3E%3Ctext x='300' y='400' font-family='Arial' font-size='32' fill='white' text-anchor='middle'%3ETikTok Content%3C/text%3E%3C/svg%3E";
                  }
                } else {
                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect width='600' height='800' fill='%23fe2c55'/%3E%3Ctext x='300' y='400' font-family='Arial' font-size='32' fill='white' text-anchor='middle'%3ETikTok Content%3C/text%3E%3C/svg%3E";
                }
              }}
            />
            <div className={styles.overlay}>
              {data.duration > 0 && (
                <div className={styles.duration}>
                  <svg viewBox="0 0 24 24" className={styles.durationIcon}>
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16zm1-8h4v2h-6V7h2v5z" />
                  </svg>
                  <span>
                    {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <svg viewBox="0 0 24 24" className={styles.statIcon}>
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
              <span className={styles.statValue}>
                <strong>{data.stats?.views.toLocaleString() || '0'}</strong>
                <span className={styles.statLabel}>Views</span>
              </span>
            </div>
            
            <div className={styles.statItem}>
              <svg viewBox="0 0 24 24" className={styles.statIcon}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className={styles.statValue}>
                <strong>{data.stats?.likes.toLocaleString() || '0'}</strong>
                <span className={styles.statLabel}>Likes</span>
              </span>
            </div>
            
            <div className={styles.statItem}>
              <svg viewBox="0 0 24 24" className={styles.statIcon}>
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
              <span className={styles.statValue}>
                <strong>{data.stats?.comments.toLocaleString() || '0'}</strong>
                <span className={styles.statLabel}>Comments</span>
              </span>
            </div>
            
            <div className={styles.statItem}>
              <svg viewBox="0 0 24 24" className={styles.statIcon}>
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
              <span className={styles.statValue}>
                <strong>{data.stats?.bookmarks.toLocaleString() || '0'}</strong>
                <span className={styles.statLabel}>Saves</span>
              </span>
            </div>
          </div>

          <div className={styles.contentInfo}>
            <div className={styles.downloadSection}>
              <h3 className={styles.downloadTitle}>Download Video</h3>
              <div className={styles.downloadButtons}>
                {/* Primary Download Button (HD/No Watermark - TikWM priority) */}
                {data.downloadOptions?.proxyUrl && (
                  <button
                    onClick={() => {
                      const url = data.downloadOptions?.proxyUrl;
                      if (url) {
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', 'Freetiktokzone_HD.mp4'); 
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link); 
                      }
                    }}
                    className={`${styles.downloadButton} ${styles.hdQuality}`}
                    title="Best Quality, No Watermark (TikWM priority)"
                  >
                    <svg viewBox="0 0 24 24" className={styles.downloadIcon}>
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /> 
                    </svg>
                    Download (No Watermark)
                  </button>
                )}

                {/* SD Download Button (Alternative Source Priority - SaveTT/SnapTik) */}
                {data.downloadOptions?.altProxyUrl && (
                  <button
                    onClick={() => {
                      const url = data.downloadOptions?.altProxyUrl;
                      if (url) {
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', 'Freetiktokzone_SD.mp4');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className={`${styles.downloadButton} ${styles.standardQuality}`}
                    title="Alternative Download (may differ in quality/size, tries other sources first)"
                  >
                    <svg viewBox="0 0 24 24" className={styles.downloadIcon}>
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Download SD
                  </button>
                )}
              </div>
              <p className={styles.downloadNote}>
                "Download (No Watermark)" uses our most reliable service. "Download SD" attempts other sources first, which might provide a different file or quality.
              </p>
            </div>
            
            <h2 className={styles.title}>
              {data.title.startsWith('Video by @') 
                ? data.title 
                : data.title.length > 100 
                  ? `${data.title.substring(0, 100)}...` 
                  : data.title
              }
            </h2>
            
            {data.hashtags && data.hashtags.length > 0 ? (
              <div className={styles.hashtags}>
                {data.hashtags.map((tag, index) => (
                  <span key={index} className={styles.hashtag}>
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.noHashtags}>No hashtags found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 