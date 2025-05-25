import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Free Tiktok Zone</title>
        <meta name="description" content="Unlock the full potential of TikTok content. Paste any TikTok video URL to instantly fetch details, view statistics, and download videos in various formats." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Component {...pageProps} />
    </>
  );
} 