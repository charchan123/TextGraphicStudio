# Phase 2.5 受入報告

実施日: 2026-09-05  
対象: ローカル開発版 `http://localhost:4175/`（公開サイトへのデプロイなし）  
実ブラウザ: Google Chrome 152.0.7977.77 / Microsoft Edge（Phase 1・2回帰）  
表示領域: 1600 × 1000

## 判定

Phase 2.5 ローカル受入: **PASS**

- Phase 1回帰: 22グループ PASS
- Phase 2回帰: 16グループ PASS
- Phase 2.5追加: 25グループ PASS
- ブラウザpage error: 0件
- lint / TypeScript / build / build:netlify: PASS

ブラウザ試験は、インストール済みの実Chrome／Edgeを起動し、クリック、テキスト範囲選択、数値入力、ファイル入力、Fabricハンドルのドラッグ、ダウンロード、再読み込みを行った結果です。参考の黄色ブラシPNGはソースへ組み込まず、通常のローカルファイル入力で使用しました。

## 追加機能の受入結果

| 分類 | 確認内容 | 結果 |
| --- | --- | --- |
| 自動追従背景 | 透過PNG／SVG読込、固定／行別追従切替、2行の実幅、本文・サイズ・字間・全体／部分glyph倍率への追従 | PASS |
| 3スライス | 左右キャップ維持、可変中央、継ぎ目なし、短い行／長い行、上下行の別bounds | PASS |
| 一体変形 | テキスト＋背景のFabricハンドル拡縮、14°回転、PNG／JSON往復 | PASS |
| 斜体 | native italic、数値slant、回転との独立、PNG反映 | PASS |
| 全体glyph倍率 | 初期100%／100%、幅90%、高さ110%、外側Fabric scale不変 | PASS |
| glyph倍率と字間 | 幅150%時も字間0→20pxの画素gap増分が20px | PASS |
| 部分glyph倍率 | 範囲幅85%、高さ120%、同一行baseline、行背景bounds、Undo／Redo、JSON／PNG | PASS |
| glyph行高 | 全範囲の部分高さ50%と全体高さ50%で、追従背景の行高が一致 | PASS |
| 部分グラデーション | 選択3文字の各文字で黄→橙を反復、未指定文字は全体色を継承 | PASS |
| 部分プロパティ優先 | 部分 > 全体。後からフォントだけ適用しても既存gradient／glyph倍率を保持。同一プロパティだけ後勝ち | PASS |
| PCフォント | Local Font Access APIで516件取得、検索、Arial追加、全体／部分適用、PNG、識別情報保存 | PASS |
| ファイルフォント | TTF／OTF／WOFF／WOFF2をFontFaceで実読込。バイナリをJSONへ含めない | PASS |
| フォントfallback | 未導入font識別情報は警告し、安全なfallbackで編集／PNGを継続 | PASS |
| API非対応 | `queryLocalFonts` 非対応分岐でもCanvasと他編集機能を維持 | PASS |
| パレット | 6色編集、各ColorFieldのチップ即時適用、JSON／localStorage／IndexedDB復元、旧JSON既定色 | PASS |
| 背景削除UI | ファイル概要と削除操作を別行へ整理、右寄せ、実削除 | PASS |
| 永続化 | palette、font metadata、全体／部分glyph倍率、部分gradient、followLines、画像data URLをIndexedDB復元 | PASS |
| 復元PNG | 復元前後のキャンバスPNGを全画素比較 | PASS（changed 0 / max 0） |

## 既存機能の回帰

次をすべてPASSとしました。

- テキスト追加、複数テキスト、複数行、ドラッグ、拡縮、回転、中央揃え
- レイヤー、表示、ロック、重なり順、複製、削除、Undo／Redo
- 数値draft入力、黄色ラフ背景、白／黒フチ、影opacity
- キャンバス背景画像、選択透明PNG、全体PNG、全件個別PNG
- テンプレートJSON保存／読込、旧schemaVersion 1、IndexedDB v1→v2移行、自動復元確認
- Instagram Reels／Threads／YouTube Shorts／Xガイド、編集非遮断、PNG非混入
- ツールバー／出力タブの共通アイコン・名称・aria-label・hover／focus tooltip

## ビルド検証

| コマンド | 結果 |
| --- | --- |
| `npm run lint` | PASS |
| `tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run build:netlify` | PASS |
| `npm run test:browser` | PASS（22） |
| `npm run test:browser:phase2` | PASS（16） |
| `npm run test:browser:phase25` | PASS（25） |

通常buildとNetlify buildには500kB超のclient chunk警告がありますが、ビルド失敗ではありません。Netlify buildの未導入optional packageに対するtrace警告も既存builder由来で、成果物生成はexit code 0です。

## 既知の制限

- 自動追従背景の短すぎる行は、左右キャップ破綻を避けるため画像全体を縮小します。キャップ境界を手動調整するUIはありません。
- 部分編集はtextarea範囲選択式です。適用済み区間を一覧から選んで再編集するリッチテキストUIではありません。
- Local Font Access APIは対応ブラウザとユーザー許可に依存します。
- ファイル追加フォントのバイナリはライセンス保護のため永続化しません。再読み込み後は同じファイルの再追加が必要です。
- SVGは安全のため外部参照、script、animation、埋込画像、text、style要素を拒否し、保存時にPNG data URL化します。
- 背景キャップ形状の高度パラメーター、自由変形、複数選択は今回の対象外です。

## スクリーンショット

1. [初期画面](../test-results/phase25/01-phase25-initial.png)
2. [6色カラーパレット](../test-results/phase25/02-color-palette.png)
3. [文字幅・高さと斜体](../test-results/phase25/03-glyph-and-slant.png)
4. [部分gradient・部分font・部分glyph倍率](../test-results/phase25/04-partial-gradient-font-glyph.png)
5. [参考PNGの固定背景](../test-results/phase25/05-png-fixed-background.png)
6. [参考PNGの自動追従背景](../test-results/phase25/06-png-auto-follow-normal-lines.png)
7. [SVG 3スライスの行別実寸追従](../test-results/phase25/07-svg-auto-follow-measured-lines.png)
8. [自動追従背景の一体拡縮・回転](../test-results/phase25/08-auto-follow-scaled-rotated.png)
9. [キャンバス背景削除ボタン配置](../test-results/phase25/09-canvas-background-delete-layout.png)
10. [PCフォント検索](../test-results/phase25/10-local-font-search.png)
11. [フォント追加後の部分style UI](../test-results/phase25/11-font-file-fallback.png)
12. [IndexedDB復元後](../test-results/phase25/12-indexeddb-restored.png)

