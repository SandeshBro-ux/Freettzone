import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from './TikTokFetcher.module.css';

interface TikTokData {
  thumbnail: string;
  title: string;
  hashtags: string[];
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
    proxyUrl?: string; // For no-watermark HD
    altProxyUrl?: string; // For watermarked HD (previously SD)
    // videoUrl?: string; // Direct from TikTok, often watermarked
    // hdVideoUrl?: string; // Direct from TikTok, often watermarked or clean
  };
  error?: string;
}

// Updated to use the provided tiktok.png image
const TikTokLogo = () => (
  <img src="/tiktok.png" alt="TikTok Logo" className={styles.tiktokLogo} />
);

const AnimatedText = ({ text }: { text: string }) => {
  return (
    <span className={styles.animatedText}>
      {text.split('').map((char, index) => (
        <span 
          key={index} 
          style={{ 
            animationDelay: `${index * 0.07 + 0.1}s`,
            display: char === ' ' ? 'inline' : 'inline-block'
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};

// New animation component with a fixed arrow
const PulseText = ({ text, type }: { text: string, type: 'watermark' | 'no-watermark' }) => {
  return (
    <span className={`${styles.arrowTextWrapper} ${type === 'watermark' ? styles.arrowWatermark : styles.arrowNoWatermark}`}>
      <span className={styles.fixedArrow}>→</span>
      <span className={styles.popupText}>
        {text.split('').map((char, index) => (
          <span
            key={index}
            className={styles.letter}
            style={{ 
              animationDelay: `${index * 0.1}s`,
              display: char === ' ' ? 'inline-block' : 'inline-block',
              width: char === ' ' ? '0.4em' : 'auto'
            }}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
};

export default function TikTokFetcher() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<TikTokData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setError('Please enter a TikTok URL');
      return;
    }
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const response = await axios.post('/api/tiktok', { url });
      setData(response.data);
      if (response.data.error) {
        setError(response.data.error);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch data. Please check the URL and try again.');
    }
    setLoading(false);
  }, [url]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      fetchData();
    }
  };

  const downloadVideo = (downloadUrl: string | undefined, filename: string) => {
    if (!downloadUrl) {
      setError('Download link is not available for this option.');
      return;
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = async (imageUrl: string | undefined, filename: string) => {
    if (!imageUrl) {
      setError('Image URL is not available for this option.');
      return;
    }
    try {
      const response = await axios.get(`/api/download-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error downloading image:', err);
      setError('Failed to download image.');
    }
  };

  const RenderData = () => {
    if (!data || data.error) return null;

    return (
      <div className={styles.resultContainer}>
        <div className={styles.profileSection}>
          {data.profile.avatar && 
            <img src={data.profile.avatar} alt={`${data.profile.username}'s avatar`} className={styles.avatar} />
          }
          <span className={styles.username}>@{data.profile.username}</span>
        </div>
        
        {data.thumbnail && 
          <div className={styles.mediaContainer}>
            <img src={data.thumbnail} alt={data.title || 'TikTok Video Thumbnail'} className={styles.thumbnail} />
          </div>
        }

        <h2 className={styles.videoTitle}>{data.title}</h2>
        
        {data.hashtags && data.hashtags.length > 0 && (
          <div className={styles.hashtagsContainer}>
            {data.hashtags.map((tag, index) => (
              <span key={index} className={styles.hashtag}>#{tag}</span>
            ))}
          </div>
        )}

        {data.stats && (
          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>❤️</span>
              <span className={styles.statLabel}>Likes</span>
              <span className={styles.statValue}>{data.stats.likes.toLocaleString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>💬</span>
              <span className={styles.statLabel}>Comments</span>
              <span className={styles.statValue}>{data.stats.comments.toLocaleString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>👀</span>
              <span className={styles.statLabel}>Views</span>
              <span className={styles.statValue}>{data.stats.views.toLocaleString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>🔖</span>
              <span className={styles.statLabel}>Bookmarks</span>
              <span className={styles.statValue}>{data.stats.bookmarks.toLocaleString()}</span>
            </div>
          </div>
        )}
        
        {data.downloadOptions && (
          <div className={styles.downloadSection}>
            <h3 className={styles.downloadTitle}>Available downloads:</h3>
            <div className={styles.downloadButtonsContainer}>
              {data.downloadOptions.proxyUrl && (
                <button 
                  onClick={() => downloadVideo(data.downloadOptions?.proxyUrl, `freettzone_HD_NoWatermark.mp4`)}
                  className={styles.downloadButtonPrimary}
                >
                  HD Download <PulseText text="Without Watermark" type="no-watermark" />
                </button>
              )}
              {data.downloadOptions.altProxyUrl && (
                <button 
                  onClick={() => downloadVideo(data.downloadOptions?.altProxyUrl, `freettzone_HD_Watermarked.mp4`)}
                  className={styles.downloadButtonSecondary}
                >
                  HD Download <PulseText text="With Watermark" type="watermark" />
                </button>
              )}
              {data.profile.avatar && (
                <button
                  onClick={() => downloadImage(data.profile.avatar, `freettzone_avatar.jpg`)}
                  className={styles.downloadButtonSecondary}
                >
                  Download Creator's Logo
                </button>
              )}
              {data.thumbnail && (
                <button
                  onClick={() => downloadImage(data.thumbnail, `freettzone_thumbnail.jpg`)}
                  className={styles.downloadButtonSecondary}
                >
                  Download Video Thumbnail
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {!data && !loading && !error && (
        <div className={styles.frontPageContent}>
          <TikTokLogo />
          <h1 className={styles.mainTitle}>TikTok Info Fetcher</h1>
          <p className={styles.mainDescription}>
            Unlock the full potential of TikTok content. Paste any TikTok video URL to instantly fetch details, view statistics, and download videos in various formats.
          </p>
          <ul className={styles.featuresListHome}>
            <li>High-Quality Downloads</li>
            <li>Watermark-Free Options</li>
            <li>Detailed Video Statistics</li>
            <li>User-Friendly Interface</li>
          </ul>
        </div>
      )}

      <div className={styles.searchContainer}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter TikTok URL (e.g., https://www.tiktok.com/@user/video/123...)"
          />
        </div>
        <button onClick={fetchData} className={styles.button} disabled={loading}>
          {loading ? <div className={styles.loader}></div> : 'Get Info'}
        </button>
      </div>

      {error && 
        <div className={styles.errorContainer}>
          <span className={styles.errorIcon}>!</span>
          <p className={styles.error}>{error}</p>
        </div>
      }
      
      {loading && !data && <div className={styles.skeletonLoader}></div>}

      <RenderData />
    </div>
  );
} 