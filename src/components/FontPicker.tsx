'use client';

import { useMemo, useRef, useState } from 'react';
import { FilePlus2, MonitorDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { FONT_OPTIONS } from '@/src/constants/editor';
import { queryInstalledFonts, registerFontFile, supportsLocalFontAccess } from '@/src/services/fontService';
import { useEditorStore } from '@/src/store/editorStore';
import type { FontReference } from '@/src/types/editor';

interface FontChoice {
  family: string;
  refId?: string;
}

interface FontFamilySelectProps {
  id: string;
  value: string;
  refId?: string;
  ariaLabel?: string;
  onChange: (choice: FontChoice) => void;
}

export function FontFamilySelect({ id, value, refId, ariaLabel, onChange }: FontFamilySelectProps) {
  const catalog = useEditorStore((state) => state.project.fontCatalog);
  const hasReference = Boolean(refId && catalog.some((font) => font.id === refId));
  const selectValue = hasReference ? `ref:${refId}` : value;
  const builtin = FONT_OPTIONS.some((font) => font.value === value);
  return (
    <NativeSelect id={id} className="w-full" aria-label={ariaLabel} value={selectValue} onChange={(event) => {
      const next = event.currentTarget.value;
      if (next.startsWith('ref:')) {
        const font = catalog.find((item) => item.id === next.slice(4));
        if (font) onChange({ family: font.family, refId: font.id });
      } else onChange({ family: next });
    }}>
      {!builtin && !hasReference && <NativeSelectOption value={value}>{value}（保存済み）</NativeSelectOption>}
      {FONT_OPTIONS.map((font) => (
        <NativeSelectOption key={font.value} value={font.value}>{font.label}</NativeSelectOption>
      ))}
      {catalog.map((font) => (
        <NativeSelectOption key={font.id} value={`ref:${font.id}`}>
          {font.fullName}（{font.source === 'file' ? 'ファイル' : 'PC'}）
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function FontPicker({ value, refId, onChange }: Omit<FontFamilySelectProps, 'id' | 'ariaLabel'>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFontReference = useEditorStore((state) => state.addFontReference);
  const setNotice = useEditorStore((state) => state.setNotice);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [available, setAvailable] = useState<FontReference[]>([]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ja');
    if (!needle) return available.slice(0, 300);
    return available.filter((font) =>
      [font.family, font.fullName, font.postscriptName, font.style].filter(Boolean).join(' ').toLocaleLowerCase('ja').includes(needle),
    ).slice(0, 300);
  }, [available, query]);

  const openLocalFonts = async () => {
    if (!supportsLocalFontAccess()) {
      setNotice('このブラウザはPCフォント一覧に対応していません。フォントファイル追加をご利用ください。', 'warning');
      return;
    }
    setBusy(true);
    try {
      const fonts = await queryInstalledFonts();
      setAvailable(fonts);
      setOpen(true);
      setNotice(`${fonts.length}件のPCフォントを取得しました。`, 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'PCフォント一覧を取得できませんでした。', 'warning');
    } finally { setBusy(false); }
  };

  const addFile = async (file: File) => {
    setBusy(true);
    try {
      const font = await registerFontFile(file);
      addFontReference(font);
      onChange({ family: font.family, refId: font.id });
      setNotice('フォントファイルをこのセッションへ追加し、選択中テキストへ適用しました。', 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'フォントファイルを読み込めませんでした。', 'error');
    } finally { setBusy(false); }
  };

  return <>
    <FontFamilySelect id="font-family" value={value} refId={refId} onChange={onChange} />
    <div className="font-source-actions">
      <Button type="button" variant="outline" disabled={busy} aria-label="PCのフォントを追加" title="PCのフォントを追加" onClick={() => void openLocalFonts()}>
        <MonitorDown aria-hidden="true" />PCのフォントを追加
      </Button>
      <Button type="button" variant="outline" disabled={busy} aria-label="フォントファイルを追加" title="フォントファイルを追加" onClick={() => fileInputRef.current?.click()}>
        <FilePlus2 aria-hidden="true" />フォントファイルを追加
      </Button>
    </div>
    <input ref={fileInputRef} className="sr-only" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" aria-label="追加するフォントファイル" onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) void addFile(file);
    }} />

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="font-browser-dialog">
        <DialogHeader>
          <DialogTitle>PCのフォントを追加</DialogTitle>
          <DialogDescription>許可されたフォントの識別情報だけを追加します。フォント本体は保存・送信しません。</DialogDescription>
        </DialogHeader>
        <label className="font-search">
          <Search aria-hidden="true" />
          <span className="sr-only">PCフォントを検索</span>
          <input type="search" value={query} aria-label="PCフォントを検索" placeholder="ヒラギノ、Morisawa、Noto、ゴシック…" onChange={(event) => setQuery(event.currentTarget.value)} />
        </label>
        <p className="font-result-count">{filtered.length}件表示 / {available.length}件</p>
        <ul className="font-result-list" aria-label="PCフォント一覧">
          {filtered.map((font) => <li key={font.id}><button type="button" className="font-result" onClick={() => {
            addFontReference(font);
            onChange({ family: font.family, refId: font.id });
            setOpen(false);
            setNotice(`${font.fullName}を追加して適用しました。`, 'success');
          }}>
            <strong style={{ fontFamily: font.family }}>{font.fullName}</strong>
            <span>{font.family}{font.style ? ` / ${font.style}` : ''}{font.weight ? ` / ${font.weight}` : ''}</span>
            {font.postscriptName && <code>{font.postscriptName}</code>}
          </button></li>)}
          {!filtered.length && <li><p className="muted-callout">一致するフォントがありません。</p></li>}
        </ul>
      </DialogContent>
    </Dialog>
  </>;
}
