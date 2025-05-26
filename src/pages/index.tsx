import TikTokFetcher from '../components/TikTokFetcher';
import styles from '../styles/Home.module.css';

export default function HomePage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to Free Tiktok Zone
        </h1>
        <TikTokFetcher />
      </main>
    </div>
  );
} 