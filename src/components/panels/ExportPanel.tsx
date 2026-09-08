'use client';

import { useState } from 'react';
import { EditorActionButton } from '@/src/components/EditorActionButton';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { SOCIAL_GUIDES, type SocialPlatform } from '@/src/constants/socialGuides';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { useEditorStore } from '@/src/store/editorStore';

interface ExportPanelProps {
  busy: boolean;
  onExportProject: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onExportFrames: () => void;
  onExportFramesZip: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function ExportPanel({
  busy,
  onExportProject,
  onExportSelected,
  onExportAll,
  onExportFrames,
  onExportFramesZip,
  onSaveTemplate,
  onLoadTemplate,
}: ExportPanelProps) {
  const [includePosition, setIncludePosition] = useState(false);
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const toggleGuides = useEditorStore((state) => state.toggleGuides);
  const setSocialGuide = useEditorStore((state) => state.setSocialGuide);
  const guide = project.canvas.socialGuide ?? { enabled: false, platform: 'instagram-reels' as const };
  const hasSelection = project.objects.some((object) => object.id === selectedId);

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>PNG書き出し</h2>
            <p>元のキャンバス解像度で保存します</p>
          </div>
        </div>
        <div className="export-button-stack">
          <EditorActionButton action="exportProject" size="lg" disabled={busy} onClick={onExportProject} />
          <EditorActionButton action="exportSelected" variant="outline" size="lg" disabled={busy || !hasSelection} onClick={onExportSelected} />
          <EditorActionButton action="exportAll" variant="outline" size="lg" disabled={busy || project.objects.length === 0} onClick={onExportAll} />
          <EditorActionButton action="exportFrames" variant="outline" size="lg" disabled={busy} onClick={onExportFrames} />
          <EditorActionButton action="exportFramesZip" variant="outline" size="lg" disabled={busy} onClick={onExportFramesZip} />
        </div>
        <p className="panel-note">透明PNGにはフチ・影・テキスト背景を含めます。キャンバス背景画像とガイドは含めません。</p>
      </section>

      <section className="panel-section">
        <h2>テンプレートJSON</h2>
        <div className="checkbox-row">
          <Checkbox
            id="template-include-position"
            checked={includePosition}
            onCheckedChange={(checked) => setIncludePosition(Boolean(checked))}
          />
          <label htmlFor="template-include-position">位置情報もテンプレートに含める</label>
        </div>
        <div className="export-button-stack compact">
          <EditorActionButton action="templateSave" variant="outline" disabled={!hasSelection} onClick={() => onSaveTemplate(includePosition)} />
          <EditorActionButton action="templateLoad" variant="outline" disabled={!hasSelection} onClick={onLoadTemplate} />
        </div>
      </section>

      <section className="panel-section">
        <h2>表示ガイド</h2>
        <ToggleRow
          label="中央ガイドを表示"
          description="ガイドはPNGに含まれません"
          checked={project.canvas.guidesVisible}
          onCheckedChange={toggleGuides}
        />
        <ToggleRow label="SNS配置ガイドを表示" description="色付き領域は配置を避ける目安です" checked={guide.enabled} onCheckedChange={(enabled) => setSocialGuide({ ...guide, enabled })} />
        <NativeSelect aria-label="SNSガイドの種類" value={guide.platform} onChange={(event) => setSocialGuide({ ...guide, platform: event.currentTarget.value as SocialPlatform })}>
          {Object.entries(SOCIAL_GUIDES).map(([value, definition]) => <NativeSelectOption key={value} value={value}>{definition.label}</NativeSelectOption>)}
        </NativeSelect>
        <div className="social-guide-settings">
          <label className="field-label" htmlFor="guide-visibility">ガイド視認性</label>
          <NativeSelect id="guide-visibility" value={guide.visibility ?? 'standard'} onChange={(event) => setSocialGuide({ ...guide, visibility: event.currentTarget.value as 'light' | 'standard' | 'strong' })}>
            <NativeSelectOption value="light">薄い</NativeSelectOption>
            <NativeSelectOption value="standard">標準</NativeSelectOption>
            <NativeSelectOption value="strong">はっきり</NativeSelectOption>
          </NativeSelect>
          <ToggleRow label="ガイドのラベルを表示" checked={guide.labelsVisible !== false} onCheckedChange={(labelsVisible) => setSocialGuide({ ...guide, labelsVisible })} />
        </div>
        <p className="panel-note">{SOCIAL_GUIDES[guide.platform]?.note}。表示領域は端末・投稿形式で変わります。公式の保証範囲ではありません。ガイドはPNGには含まれません。</p>
      </section>

      <section className="privacy-card">
        <strong>ローカル処理</strong>
        <p>読み込んだ画像や制作内容は外部サーバーへ送信されません。</p>
      </section>
    </div>
  );
}
