import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Text Graphic Studio',
  description: 'SNS画像・動画制作用のローカルテキストグラフィック編集アプリ',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
