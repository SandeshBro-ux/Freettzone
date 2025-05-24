import { useState } from 'react';
import axios from 'axios';

interface TikTokData {
  thumbnail: string;
  title: string;
  hashtags: string[];
  duration: number;
  profile: {
    username: string;
    avatar: string;
  };
}

export default function TikTokFetcher() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<TikTokData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/tiktok', { url });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="input-section">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter TikTok URL"
        />
        <button onClick={fetchData} disabled={loading}>
          {loading ? 'Fetching...' : 'Get Info'}
        </button>
      </div>

      {data && (
        <div className="result-section">
          <div className="profile-info">
            <img src={data.profile.avatar} alt="Profile" />
            <h3>@{data.profile.username}</h3>
          </div>
          <img src={data.thumbnail} alt="Video thumbnail" className="thumbnail" />
          <div className="video-info">
            <h4>{data.title}</h4>
            <div className="hashtags">
              {data.hashtags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <p>Duration: {Math.floor(data.duration / 60)}m {data.duration % 60}s</p>
          </div>
        </div>
      )}
    </div>
  );
}