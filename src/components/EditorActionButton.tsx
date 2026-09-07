'use client';

import type { ComponentProps } from 'react';
import { Eye, FileDown, FileJson, FolderDown, FolderInput, PackageOpen, ImageDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarTooltip } from '@/src/components/ToolbarTooltip';

export const EDITOR_ACTIONS = {
  outputPreview: { icon: Eye, label: '出力プレビュー' },
  projectExport: { icon: PackageOpen, label: 'プロジェクトを書き出す' },
  projectImport: { icon: FolderInput, label: 'プロジェクトを読み込む' },
  templateLoad: { icon: FileJson, label: 'テンプレートJSONを読み込む' },
  templateSave: { icon: Save, label: '選択中の設定をテンプレート保存' },
  exportSelected: { icon: FileDown, label: '選択中のテキストを透明PNG保存' },
  exportProject: { icon: ImageDown, label: 'キャンバス全体をPNG保存' },
  exportAll: { icon: FolderDown, label: 'すべてを個別に透明PNG保存' },
} as const;

type Props = Omit<ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
  action: keyof typeof EDITOR_ACTIONS;
  iconOnly?: boolean;
};

export function EditorActionButton({ action, iconOnly = false, ...props }: Props) {
  const { icon: Icon, label } = EDITOR_ACTIONS[action];
  return (
    <ToolbarTooltip label={label}>
      <Button {...props} aria-label={label} data-editor-action={action}>
        <Icon aria-hidden="true" />
        <span className={iconOnly ? 'sr-only' : undefined}>{label}</span>
      </Button>
    </ToolbarTooltip>
  );
}
