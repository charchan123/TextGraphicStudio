'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackgroundPanel } from '@/src/components/panels/BackgroundPanel';
import { ExportPanel } from '@/src/components/panels/ExportPanel';
import { LayerPanel } from '@/src/components/panels/LayerPanel';
import { StylePanel } from '@/src/components/panels/StylePanel';
import { TextPanel } from '@/src/components/panels/TextPanel';

interface InspectorPanelProps {
  busy: boolean;
  onExportProject: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function InspectorPanel(props: InspectorPanelProps) {
  return (
    <aside className="inspector" aria-label="コントロールパネル">
      <Tabs defaultValue="text" className="inspector-tabs">
        <TabsList variant="line" className="inspector-tablist">
          <TabsTrigger value="text">テキスト</TabsTrigger>
          <TabsTrigger value="style">スタイル</TabsTrigger>
          <TabsTrigger value="background">背景</TabsTrigger>
          <TabsTrigger value="layers">レイヤー</TabsTrigger>
          <TabsTrigger value="export">出力</TabsTrigger>
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
