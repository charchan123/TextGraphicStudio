'use client';

import { useState } from 'react';
import { Download, FileJson, FolderDown, ImageDown, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { useEditorStore } from '@/src/store/editorStore';

interface ExportPanelProps {
  busy: boolean;
  onExportProject: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function ExportPanel({
  busy,
  onExportProject,
  onExportSelected,
  onExportAll,
  onSaveTemplate,
  onLoadTemplate,
}: ExportPanelProps) {
  const [includePosition, setIncludePosition] = useState(false);
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const toggleGuides = useEditorStore((state) => state.toggleGuides);
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
          <Button size="lg" disabled={busy} onClick={onExportProject}>
            <Download aria-hidden="true" />キャンバス全体をPNG保存
          </Button>
          <Button variant="outline" size="lg" disabled={busy || !hasSelection} onClick={onExportSelected}>
            <ImageDown aria-hidden="true" />選択中を透明PNG保存
          </Button>
          <Button variant="outline" size="lg" disabled={busy || project.objects.length === 0} onClick={onExportAll}>
            <FolderDown aria-hidden="true" />すべてを個別に透明PNG保存
          </Button>
        </div>
        <p className="panel-note">透明PNGにはキャンバス背景画像を含めません。フチ・影・黄色背景は一緒に保存されます。</p>
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
          <Button variant="outline" disabled={!hasSelection} onClick={() => onSaveTemplate(includePosition)}>
            <FileJson aria-hidden="true" />選択中の設定を保存
          </Button>
          <Button variant="outline" disabled={!hasSelection} onClick={onLoadTemplate}>
            <Upload aria-hidden="true" />JSONを読み込んで適用
          </Button>
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
      </section>

      <section className="privacy-card">
        <strong>ローカル処理</strong>
        <p>読み込んだ画像や制作内容は外部サーバーへ送信されません。</p>
      </section>
    </div>
  );
}
