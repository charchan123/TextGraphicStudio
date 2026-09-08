'use client';

import { Download, Image as ImageIcon, Layers3, Palette, Type } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackgroundPanel } from '@/src/components/panels/BackgroundPanel';
import { ExportPanel } from '@/src/components/panels/ExportPanel';
import { LayerPanel } from '@/src/components/panels/LayerPanel';
import { StylePanel } from '@/src/components/panels/StylePanel';
import { TextPanel } from '@/src/components/panels/TextPanel';

interface InspectorPanelProps {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  busy: boolean;
  onExportProject: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onExportFrames: () => void;
  onExportFramesZip: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function InspectorPanel(props: InspectorPanelProps) {
  return (
    <aside className="inspector" aria-label="コントロールパネル">
      <Tabs value={props.activeTab} onValueChange={props.onActiveTabChange} className="inspector-tabs">
        <TabsList variant="line" className="inspector-tablist">
          <TabsTrigger value="text" className="inspector-tab">
            <Type aria-hidden="true" />
            <span>テキスト</span>
          </TabsTrigger>
          <TabsTrigger value="style" className="inspector-tab">
            <Palette aria-hidden="true" />
            <span>スタイル</span>
          </TabsTrigger>
          <TabsTrigger value="background" className="inspector-tab">
            <ImageIcon aria-hidden="true" />
            <span>背景</span>
          </TabsTrigger>
          <TabsTrigger value="layers" className="inspector-tab">
            <Layers3 aria-hidden="true" />
            <span>レイヤー</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="inspector-tab">
            <Download aria-hidden="true" />
            <span>出力</span>
          </TabsTrigger>
        </TabsList>
        <div className="inspector-scroll">
          <TabsContent value="text"><TextPanel /></TabsContent>
          <TabsContent value="style"><StylePanel /></TabsContent>
          <TabsContent value="background"><BackgroundPanel /></TabsContent>
          <TabsContent value="layers"><LayerPanel /></TabsContent>
          <TabsContent value="export"><ExportPanel {...props} /></TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
