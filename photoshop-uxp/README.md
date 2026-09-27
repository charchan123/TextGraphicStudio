# Text Graphic Studio Bridge（Phase 3.1A MVP）

Text Graphic Studio（TGS）の現在コマを、Photoshopで直接編集できるネイティブText Layerとして読み込む開発版UXPプラグインです。処理はすべてPC内で完結し、外部サーバーへデータを送りません。

## 必要環境

- Adobe Photoshop 24.2以降
- Adobe UXP Developer Tool
- TGSから書き出した `.tgsps.json` ファイル

このmanifestのPlugin IDは開発用です。Marketplace配布用IDではありません。

## UXP Developer Toolへ読み込む

1. PhotoshopとUXP Developer Toolを起動します。
2. UXP Developer Toolで「Add Plugin」を押します。
3. このフォルダーの `manifest.json` を選択します。
4. 一覧へ追加された「Text Graphic Studio Bridge」の「Load」を押します。
5. Photoshopの「プラグイン」メニューから「Text Graphic Studio Bridge」を開きます。

コードを更新した後は、UXP Developer Toolの「Reload」を押してください。Plugin専用のbuild作業は不要です。

## TGSからBridgeファイルを書き出す

1. TGSでPhotoshopへ渡すコマを選択します。
2. 右側の「出力」タブを開きます。
3. 「Photoshop Bridge（β）」の「現在のコマを書き出す」を押します。
4. `トップ.tgsps.json` などのBridgeファイルが保存されます。

## Photoshopへ読み込む

1. Photoshopで、TGSと同じピクセルサイズのDocumentを先に開きます。
2. Plugin Panelで「TGSファイルを選択」を押し、`.tgsps.json` を選びます。
3. Project名、コマ名、Canvasサイズ、Text object数を確認します。
4. 「Photoshopへ読み込み」を押します。
5. `TGS_トップ` などの新しいGroup内に、編集可能なText Layerが作成されます。

BridgeとPhotoshop DocumentのCanvasサイズが違う場合はImportを停止します。自動拡大・縮小やDocument resizeは行いません。同じBridgeを再Importした場合は、既存Groupを上書きせず `TGS_トップ 2` のような新しいGroupを追加します。

## Phase 3.1Aで対応するもの

- Text内容と改行（日本語を含むUTF-8）
- Font（PostScript名を優先し、次にfamily + style）
- Font size
- 単色Fill
- 字間（Photoshop trackingへ変換）
- 行間（Photoshop leadingへ変換）
- 全体のhorizontal / vertical scale
- Text alignment
- TGSのvisual centerを基準にした位置合わせ
- Object rotation
- Frame内TextObjectの重なり順

FontがPhotoshopにない場合はPhotoshop既定FontでLayerを作り、Import Reportへ警告します。

## 現在未対応の表現

次の情報はBridge JSONへ将来用metadataとして残しますが、Phase 3.1AではPhotoshop上へ完全再現しません。該当するとImport Reportへwarningを表示します。

- 部分文字Style
- Gradient
- フチ1～3
- Shadow
- glyphOffsetX / glyphOffsetY
- fontWeightAdjust
- 行間の個別調整
- Text背景、horizontal 3-slice、行ごとの背景左右端補正
- Smart Object化

Text背景画像のdata URLやSVG markupなどのbinary相当データはBridgeへ埋め込みません。

## Troubleshooting

### 「Photoshopで先にドキュメントを開いてください」

PhotoshopでImport先Documentを開いてから、もう一度「Photoshopへ読み込み」を押してください。Pluginは勝手に新しいDocumentを作りません。

### 「キャンバスサイズが一致しません」

TGS BridgeのCanvas幅・高さと、Photoshop Documentのピクセル幅・高さを同じにしてください。縦横が逆の場合もImportしません。

### Fontが違う

Import ReportのMissing fontを確認してください。TGSのPostScript名と同じFont faceがPhotoshop側で利用できない場合は既定Fontになります。FontをOSへ追加した後は、Photoshopを再起動してから再Importしてください。

### 位置や行間が少し違う

TGS/FabricとPhotoshopではFont metricsやText baselineが異なります。PluginはText style適用後のPhotoshop boundsを測り、TGSのvisual centerへ移動して差を吸収しますが、Phase 3.1Aでは完全なpixel一致を保証しません。

### Pluginが読み込めない

`manifest.json` を直接選択していること、Photoshopが24.2以降であることを確認してください。UXP Developer ToolのLogsにも詳細が表示されます。
