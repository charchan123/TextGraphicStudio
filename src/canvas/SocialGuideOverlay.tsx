import { SOCIAL_GUIDES } from '@/src/constants/socialGuides';
import type { CanvasSettings } from '@/src/types/editor';

export function SocialGuideOverlay({ guide }: { guide: CanvasSettings['socialGuide'] }) {
  if (!guide?.enabled) return null;
  const definition = SOCIAL_GUIDES[guide.platform];
  if (!definition) return null;
  const { top, bottom, left, right } = definition;
  const areas = [
    { x: 0, y: 0, width: 1, height: top, label: '上部' },
    { x: 0, y: 1 - bottom, width: 1, height: bottom, label: '下部' },
    { x: 0, y: top, width: left, height: 1 - top - bottom, label: '左端' },
    { x: 1 - right, y: top, width: right, height: 1 - top - bottom, label: '右端' },
  ];
  return <div className="social-guide-overlay" aria-hidden="true" data-social-platform={guide.platform} data-visibility={guide.visibility ?? 'standard'}>
    {areas.map((area, index) => <div key={index} className="social-guide-area" style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%` }}>{guide.labelsVisible !== false && <span>{area.label}</span>}</div>)}
    {guide.labelsVisible !== false && <span className="social-guide-title">{definition.label}・配置目安</span>}
  </div>;
}
