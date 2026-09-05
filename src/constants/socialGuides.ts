export type SocialPlatform = 'instagram-reels' | 'threads' | 'youtube-shorts' | 'x';

/** Conservative application presets, not guaranteed or official platform dimensions. */
export const SOCIAL_GUIDES: Record<SocialPlatform, { label: string; top: number; bottom: number; left: number; right: number; note: string }> = {
  'instagram-reels': { label: 'Instagramリール', top: 0.14, bottom: 0.35, left: 0.06, right: 0.18, note: '縦型閲覧時の説明・操作UIを避ける目安' },
  threads: { label: 'Threads', top: 0.08, bottom: 0.12, left: 0.05, right: 0.05, note: 'フィード投稿画像で端に寄せすぎないための目安' },
  'youtube-shorts': { label: 'YouTube Shorts', top: 0.10, bottom: 0.25, left: 0.05, right: 0.18, note: '縦型閲覧時の説明・右側操作UIを避ける目安' },
  x: { label: 'X', top: 0.10, bottom: 0.20, left: 0.05, right: 0.05, note: '縦型閲覧と投稿画像の端余白の目安' },
};
