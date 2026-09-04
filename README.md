# Text Graphic Studio

Text Graphic Studio は、SNS・Instagram・YouTube向けのタイトル画像をPCブラウザ内だけで制作するテキストグラフィック編集アプリです。画像の上へ、太い二重フチ付き日本語テキストと黄色いラフ背景を配置し、キャンバス全体またはテキスト単体をPNGとして保存できます。

このリポジトリは Phase 1 の実装です。バックエンド、ユーザー登録、クラウド保存、外部画像APIは使用しません。

## 必要環境

- Windows 10 / 11（主対象）
- Node.js 22.13 以上のLTS環境
- npm
- Canvas、IndexedDB、File APIを利用できる最新のChrome / Edge系ブラウザ

## インストールと起動

```bash
npm install
npm run dev
```

表示されたローカルURL（通常は `http://localhost:3000/`）をブラウザで開きます。

本番ビルド確認:

```bash
npm run build
```

品質チェック:

```bash
npm run lint
npx tsc --noEmit
npm run test:browser
```

`test:browser` はWindows標準のMicrosoft Edgeを利用し、主要な編集フロー、PNG寸法・透過、テンプレート、自動復元を実ブラウザで確認します。

## Netlifyへの公開

通常の npm run build は、Cloudflare Worker向けのVinext成果物を dist/client と dist/serverへ生成します。これは静的サイト用フォルダーではないため、distをNetlifyのDeploys画面へドラッグしてもトップページは動きません。

Netlifyでは、Vinext公式のNitroアダプターを使う専用ビルドを実行します。

~~~bash
npm run build:netlify
~~~

このビルドは公開アセットを dist、SSR/RSC用の生成Functionを .netlify/functions-internalへ出力します。Functionはルート全体を処理し、静的アセットが存在する場合はそちらを優先します。

### GitHub連携

このフォルダーがまだGitHubにない場合は、先にGitHubでリポジトリを作成し、プロジェクト一式をcommit・pushしてください。その後、Netlifyの「Add new project」→「Import an existing project」からGitHubのリポジトリを選びます。

ルートの netlify.toml に設定済みなので、Netlify管理画面では原則として値を追加・変更する必要はありません。確認する場合は次の値になっていることを確かめてください。`netlify.toml`の設定が管理画面より優先されます。

| 項目 | 入力値 |
| --- | --- |
| Base directory | 空欄 |
| Build command | npm run build:netlify |
| Publish directory | dist |
| Functions directory | 空欄 |
| Node.js | 22.13.0 |
| NITRO_PRESET | netlify |

Build command、Publish directory、Base directoryは「Build settings」で確認します。Node.jsとNITRO_PRESETはビルド環境設定ですが、どちらも`netlify.toml`とnpmスクリプトで設定済みです。

Functions directoryは空欄のままにします。Nitroが生成する .netlify/functions-internal はNetlifyが自動検出する内部成果物で、管理画面から手動指定するユーザーFunctionディレクトリではありません。`.netlify/functions-internal`をFunctions directoryへ入力しないでください。

### 手動デプロイ

この構成ではNetlify管理画面へのフォルダードラッグ＆ドロップを使用しません。ドラッグ＆ドロップではNitroのSSR Functionを一緒に処理できないためです。Netlify CLIを使うと、distと生成Functionの両方が正しくアップロードされます。

先にNetlify管理画面で空のプロジェクトを作るか、GitHub連携でプロジェクトを作成してから、プロジェクト直下で次を実行します。`link`では、その既存Netlifyプロジェクトを選択します。Netlify CLI 27以降の`deploy`は、`--no-build`を付けない限り、`netlify.toml`のビルドを実行してから静的ファイルとFunctionをアップロードします。

~~~powershell
npx netlify-cli@27.0.1 login
npx netlify-cli@27.0.1 link
npx netlify-cli@27.0.1 deploy
~~~

最初の deploy は確認用URLへ公開します。動作確認後、本番URLへ反映します。

~~~powershell
npx netlify-cli@27.0.1 deploy --prod
~~~

### ローカルでNetlify相当を確認

Netlify CLIの serve は、本番ビルド、Functionの梱包、ローカル配信をまとめて実行します。

~~~powershell
npx netlify-cli@27.0.1 serve
~~~

起動後、表示されたURL（通常は http://localhost:8888/）を開きます。
このコマンドはファイル変更を監視しません。変更後は`Ctrl + C`で停止し、もう一度実行してください。

## 基本操作

1. 上部の「背景画像」からPNG、JPG、JPEG、WEBPを選びます。
2. 右側「テキスト」タブへ複数行の文字を入力し、「テキストを追加」を押します。
3. キャンバス上のテキストを選び、右側の各タブでフォント、サイズ、色、フチ、影、黄色背景を調整します。
4. キャンバス上でドラッグ移動し、四隅のハンドルで等比拡縮、上部ハンドルで回転します。
5. 「レイヤー」タブで表示、ロック、名前、削除、重なり順を変更します。
6. 上部または「出力」タブからPNGやテンプレートJSONを保存します。

背景画像は編集オブジェクトではなく、選択・移動・回転・拡縮できない固定背景です。高さをキャンバスへ合わせ、水平中央へ配置します。画像がキャンバスより横長の場合、左右のはみ出し部分が中央基準で切り取られます。

## キーボードショートカット

| 操作 | ショートカット |
| --- | --- |
| 元に戻す | `Ctrl + Z` |
| やり直す | `Ctrl + Shift + Z` / `Ctrl + Y` |
| 選択中を複製 | `Ctrl + D` |
| 選択中を削除 | `Delete` / `Backspace` |
| 1px移動 | 矢印キー |
| 10px移動 | `Shift + 矢印キー` |

テキスト入力欄、数値欄、セレクト、HEX欄へフォーカスしている間は、通常の文字編集や矢印操作を優先します。日本語IME変換中もキャンバス用ショートカットは発火しません。

## Phase 1で実装済みの機能

- 1920×1080を初期値とする内部原寸キャンバスと自動Fit表示
- 1920×1080、1080×1920、1080×1080、カスタムのサイズ切替
- PNG / JPG / JPEG / WEBP固定背景の読込・削除・高さ基準中央配置
- 複数行日本語テキストの追加と複数配置
- PC内の一般的な日本語フォント候補と安全なフォールバック
- 文字色、太字、サイズ、字間、行間、左・中央・右揃え、回転
- 白フチ、その外側の黒フチ、影（色・ぼかし・X・Y）
- 単純な四角形ではない、seed付きラフ端の黄色背景
- グループ全体角度と黄色背景の追加角度の独立管理
- Fabric.jsによる選択、移動、等比拡縮、回転
- レイヤー選択、名前変更、表示、ロック、削除、4種類の重なり順操作
- 複製ボタンと `Ctrl + D`
- 追加、削除、移動、拡縮、回転、文字・スタイル変更のUndo / Redo（最大60状態）
- キャンバス全体の原寸PNG保存
- 選択中テキストだけの最小余白・透明PNG保存
- 表示中の全テキストを個別の透明PNGとして順番に保存
- 選択中スタイルのテンプレートJSON保存・読込・再適用
- IndexedDBへのデバウンス自動保存と、起動時の復元確認
- 書き出しへ混入しない中央縦横ガイド
- 新規プロジェクトの確認ダイアログ、日本語通知、狭い画面でのスクロール対応

## ファイル構造

```text
app/
  page.tsx                 エディタ画面の入口
  layout.tsx               日本語メタデータと共通レイアウト
  globals.css              編集ソフト向けUIとレスポンシブスタイル
src/
  canvas/
    FabricCanvas.tsx       Fabricキャンバス初期化・同期・背景表示
    graphicTextRenderer.ts 二重フチ文字と黄色帯を1グループとして描画
    roughBand.ts           seed付きラフ背景形状
    GuideOverlay.tsx       書き出し非対象の中央ガイド
  components/
    EditorApp.tsx          自動保存・復元・出力を含むアプリ統合
    EditorToolbar.tsx      上部ツールバー
    InspectorPanel.tsx     右側タブパネル
    controls/              スライダー、色、トグル等の共通部品
    panels/                テキスト、スタイル、背景、レイヤー、出力
  constants/               フォント、キャンバスプリセット等
  hooks/                   ショートカット、履歴トランザクション、WebMCP
  services/                PNG、画像、テンプレート、IndexedDB
  store/                   Zustand状態、履歴、初期データ
  types/                   プロジェクト・テキスト・テンプレート型
scripts/
  phase1-browser-check.mjs 実ブラウザのPhase 1回帰テスト
netlify.toml               Netlify向けビルド・公開設定
```

## データ設計

保存の正はFabric.jsのJSONではなく、アプリ固有の `ProjectDocument` と `GraphicTextObject` です。各テキストは文字組み、塗り、内外フチ、影、黄色背景、変形、将来用の部分スタイル・文字種倍率を独立して保持します。

描画時には「黄色背景・黒外フチ・白フチ・文字」を1個のFabric `Group`へまとめるため、移動・拡縮・回転時に同期ずれが発生しません。Phase 2以降ではラフ背景レンダラー、部分文字スタイル、文字種別レイアウトを個別に差し替えられます。

## 今後のPhase

- Phase 2: 本格的なブラシ形状、複数形状、粗さ・ギザギザ量・非対称・seed・padding・背景回転の拡張
- Phase 3: 文字範囲選択、部分色、赤・青・黒、黄色グラデーション
- Phase 4: 漢字・ひらがな・カタカナ・数字・英字ごとのサイズ倍率を実描画へ反映
- Phase 5: プリセット管理、お気に入り、最近使用、複数選択、グループ、整列、スナップ、ZIP、プロジェクトファイル保存・読込

## 既知の制限

- Phase 1の黄色背景はラフなポリゴン帯です。本格的な筆跡・ブラシテクスチャはPhase 2の対象です。
- `partialStyles` と文字種別倍率は将来互換のデータを保持していますが、文字範囲UIと個別レイアウトはまだ適用しません。
- フォントの見た目はPCへインストール済みのフォントに依存します。未導入フォントは日本語対応フォールバックへ切り替わります。
- 高さ基準配置を厳密に守るため、9:16画像を16:9キャンバスへ置くと左右に余白が生じます。左右クロップは、キャンバスより横長の画像で発生します。
- 全テキストの個別保存では、ブラウザが「複数ファイルのダウンロード」許可を求める場合があります。ZIP化はPhase 5の対象です。
- IndexedDBの保存容量と保持期間はブラウザ設定に依存します。プライベートブラウズやサイトデータ削除では復元できません。
- VinextとNitroは現在ベータ版です。依存更新時は通常ビルドとNetlifyビルドの両方を再検証してください。

## プライバシー

読み込んだ画像、テキスト、テンプレート、制作データは外部サーバーへアップロードしません。画像処理とPNG合成はFabric.jsとブラウザCanvasで完結し、自動保存は利用中ブラウザのIndexedDB内だけに保存します。
