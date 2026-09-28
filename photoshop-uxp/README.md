# Text Graphic Studio Bridge（Phase 3.1B）

Text Graphic Studio（TGS）の現在コマを、Photoshopで直接編集できるネイティブText Layerと背景へ変換する開発版UXPプラグインです。処理はすべてPC内で完結し、外部サーバーへデータを送りません。

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
3. Project名、コマ名、Canvasサイズ、Bridge version、Text object数、Background数を確認します。
4. 「Photoshopへ読み込み」を押します。
5. Bridge v2では、`TGS_トップ` などの新しいGroup内にTextObject単位のSmart Objectが作成されます。

BridgeとPhotoshop DocumentのCanvasサイズが違う場合はImportを停止します。自動拡大・縮小やDocument resizeは行いません。同じBridgeを再Importした場合は、既存Groupを上書きせず `TGS_トップ 2` のような新しいGroupを追加します。

## Bridge v2と背景

Bridge v2は、別PCでも1つの `.tgsps.json` だけでImportできるよう、次のPNG assetをbase64で内包します。ローカルファイルpathは保存しません。

- `background-render`: fixed / auto-follow / followLines / horizontal 3-slice / 行ごとの左右端補正を反映した現在表示中の背景
- `background-source-raster`: 将来の背景再フィットに使う元素材のPNG。SVG素材もTGS側でPNG化します

背景PNGは透明部分を含む必要最小限の範囲へcropされます。破損・欠落した背景assetはその背景だけをskipし、Text LayerのImportは続行します。Bridge v1も従来どおりText Layerとして読み込めます。

## Smart Objectを開いてTextを編集する

Bridge v2のLayer構造は次のとおりです。

```text
TGS_トップ
└─ TGS_テキスト1             [Smart Object]
   ├─ TGS_TEXT_<objectId>     [native editable Text]
   └─ TGS_BG_<objectId>       [pixel background]
```

1. PhotoshopのLayers Panelで `TGS_テキスト1` などのSmart Object thumbnailをダブルクリックします。
2. 開いたSmart Object contentsで `TGS_TEXT_<objectId>` を選び、文字ツールで編集します。
3. Smart Object contentsを保存して閉じます。

TextとBackgroundはmergeされず、別Layerのままです。Smart Object化に失敗したObjectは削除されずGroupのまま残り、Import Reportにwarningが出ます。

Bridge v2 Import時は、Smart Object内部CanvasへText編集用の透明余白を追加します。TextやBackground自体は拡大せず、TGS Canvasサイズを上限として左右・上下へ均等にCanvasだけを広げます。初期文字列より多少長い文字へ変更した場合のclipを軽減します。

重要: Phase 3.1Bでは、文字変更後の背景は自動で伸縮・再フィットされません。背景再フィットはPhase 3.1Cで対応予定です。

## Phase 3.1Bで対応するもの

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
- TGSで現在表示されているText背景のpixel Layer転送
- Text + BackgroundのTextObject単位Smart Object化

FontがPhotoshopにない場合はPhotoshop既定FontでLayerを作り、Import Reportへ警告します。

## 現在未対応の表現

次の情報はBridge JSONへ将来用metadataとして残しますが、Photoshop native Textとしては完全再現しません。該当するとImport Reportへwarningを表示します。

- 部分文字Style
- Gradient
- フチ1～3
- Shadow
- glyphOffsetX / glyphOffsetY
- fontWeightAdjust
- 行間の個別調整
- PhotoshopでText編集後の背景自動再フィット

horizontal 3-slice、`textLineIds`、`lineEdgeAdjustments`、padding / offset / follow mode、元背景のraster PNGはPhase 3.1C用metadataとして保持します。

## Troubleshooting

### 「Photoshopで先にドキュメントを開いてください」

PhotoshopでImport先Documentを開いてから、もう一度「Photoshopへ読み込み」を押してください。Pluginは勝手に新しいDocumentを作りません。

### 「キャンバスサイズが一致しません」

TGS BridgeのCanvas幅・高さと、Photoshop Documentのピクセル幅・高さを同じにしてください。縦横が逆の場合もImportしません。

### Fontが違う

Import ReportのMissing fontを確認してください。TGSのPostScript名と同じFont faceがPhotoshop側で利用できない場合は既定Fontになります。FontをOSへ追加した後は、Photoshopを再起動してから再Importしてください。

### 位置や行間が少し違う

TGS/FabricとPhotoshopではFont metricsやText baselineが異なります。PluginはText style適用後のPhotoshop boundsを測り、TGSのvisual centerへ移動して差を吸収しますが、完全なpixel一致を保証しません。

### BackgroundまたはSmart Objectが作られない

Import Reportのwarningを確認してください。背景assetが破損・欠落している場合はTextだけImportします。Smart Object変換が失敗した場合は、編集内容を失わないようText + Background Groupを残します。

### Pluginが読み込めない

`manifest.json` を直接選択していること、Photoshopが24.2以降であることを確認してください。UXP Developer ToolのLogsにも詳細が表示されます。
