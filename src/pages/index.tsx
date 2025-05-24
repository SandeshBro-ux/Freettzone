import TikTokFetcher from '../components/TikTokFetcher';
import styles from '../styles/Home.module.css';

export default function HomePage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          TikTok Info Fetcher
        </h1>
        <TikTokFetcher />
      </main>
    </div>
  );
} 