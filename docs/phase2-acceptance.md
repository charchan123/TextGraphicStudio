# Text Graphic Studio — Phase 2 受入報告

実施日: 2026-09-05 / 対象: http://localhost:3000/ / Windows Microsoft Edge 152.0.4191.62 / 1600×1000。
Playwright経由で実ブラウザのクリック、キーボード入力、範囲選択、スライダー数値、Canvasドラッグ・ハンドル操作、ローカルファイル入力、ダウンロードを実施しました。

## 1. 実装完了 / 未完了

Phase 2の必須機能はローカル実装・受入検証完了です。既存22グループ、新規16グループは全PASS、最終試験のpageerrorは0件でした。
公開Netlifyサイトへの反映は未実施です。デプロイ成功・公開版動作を確認したという報告ではありません。

React / TypeScript / Vite / Vinext / Fabric.js / Zustand / IndexedDBの構成を維持しています。PNG出力は既存経路の前段に画像準備を追加、テンプレートは既存形式の検証を拡張しています。Netlifyバッジ用のCSSや回避レイアウトは追加していません。参考画像は固定アセットにせず、参考PNGを通常のファイル入力から読み込みました。

## 2. 変更した主なファイル

| 領域 | ファイル |
| --- | --- |
| 型・既定値・状態 | `src/types/editor.ts`, `src/store/defaults.ts`, `src/store/editorStore.ts` |
| 部分スタイル・グラデーション描画 | `src/canvas/StyledGraphicText.ts`, `src/canvas/graphicTextRenderer.ts` |
| 背景描画・準備・同期 | `src/canvas/backgroundRenderer.ts`, `src/canvas/FabricCanvas.tsx`, `src/services/textBackgroundAssets.ts` |
| SNSガイド | `src/constants/socialGuides.ts`, `src/canvas/SocialGuideOverlay.tsx` |
| 部分編集UI | `src/components/panels/PartialStyleEditor.tsx`, `src/components/panels/TextPanel.tsx`, `src/services/partialStyles.ts` |
| 背景・スタイルUI | `src/components/panels/TextBackgroundEditor.tsx`, `src/components/panels/BackgroundPanel.tsx`, `src/components/panels/StylePanel.tsx` |
| 共有アクション | `src/components/EditorActionButton.tsx`, `src/components/EditorToolbar.tsx`, `src/components/ToolbarTooltip.tsx`, `src/components/panels/ExportPanel.tsx`, `src/components/EditorApp.tsx` |
| 保存・出力・検証 | `src/services/persistence.ts`, `src/services/templateService.ts`, `src/services/exportService.ts`, `src/services/styleValidation.ts` |
| CSS | `app/globals.css` |
| 試験・説明 | `scripts/phase1-browser-check.mjs`, `scripts/phase2-browser-check.mjs`, `package.json`, `README.md`, 本報告 |

## 3. 追加した主な機能

- テキストエリアの選択範囲に色・絶対サイズ・字間・太字を適用。部分設定を優先し、範囲解除・全解除・テキスト挿入時の追従に対応。
- テキスト全体の線形グラデーション。単色切替、開始色・終了色、0.1°の角度調整。
- 既存の影opacityを維持し、0/50/100%と出力・保存を検証。
- 4種類のSNS配置ガイド。非操作DOMオーバーレイとして表示し、中央ガイド・PNG出力と分離。
- テキストごとのPNG/SVG背景。文字と同じFabric Group内に置き、余白・追加角度・移動・拡縮・回転に対応。
- 画像背景プリセットのローカル保存・再適用・削除。適用はUndo/Redoに対応。
- 背景タイプと背景レンダラーの分岐、データ駆動の背景選択肢。
- FileJson / Save / FileDown / ImageDown / FolderDownを共有定義し、ツールバーと出力タブの名称・aria-label・hover/focusツールチップを統一。右タブの選択状態と並びを調整。

試験中に検出して修正した問題:
1. 画像準備の非同期化で、新規テキストのFabric Groupができる前に選択が解除される競合。選択の同期処理で準備待ちを考慮しました。
2. キャッシュ済み画像だけ寸法検証が省略される問題。毎回実寸照合し、改変テンプレートを拒否します。

## 4. 保存形式変更の有無

JSONのschemaVersionは1を維持し、フィールドを追加しています。旧rough-bandは新しい黄色ラフ背景の別名として読めます。旧テンプレートの読込、旧IndexedDB v1の作業復元を実ブラウザで確認しました。新しい背景タイプを含むJSONをPhase 1アプリへ戻す互換性は保証しません。

| データ | 形式・扱い |
| --- | --- |
| 部分指定 | `partialStyles[]`: UTF-16のstart/end、任意のfill/fontSize/letterSpacing/fontWeight。旧fontScaleも保持。後の範囲がプロパティごとに優先 |
| グラデーション | 既存FillStyleのlinear-gradient、angle、stops |
| 影 | 既存shadow.opacity（0〜1） |
| テキスト背景 | none / generatedRoughYellow / uploadedImage。旧rough-bandも許容 |
| 画像 | background.imageにid/fileName/sourceMimeType/dataUrl/width/height。SVGもブラウザ内でPNG化し、自己完結するdata URLで保存 |
| ガイド | 任意のcanvas.socialGuide: enabled/platform。旧データはOFF |
| IndexedDB | DBバージョン1→2。projectsを残しbackground-presetsストアを追加 |
| 背景プリセット | id/name/savedAt/background。画像データも含み、配置後はプリセット削除と独立 |

作業の状態変更はZustand履歴へ記録します。プリセット一覧の保存・削除自体は作業キャンバスのUndo/Redoとは別管理です。復元確認「前回の作業を復元しますか」は変更していません。

## 5. 受入試験結果（PASS / FAIL）

| 区分 | 結果 | 実ブラウザで確認した内容 |
| --- | --- | --- |
| A 既存機能 | PASS | 追加・複数行・複数配置・ドラッグ・Fabricハンドル拡縮・回転・複製・削除・Undo/Redo・レイヤー操作 |
| A 背景/保存 | PASS | 固定背景PNG読込・削除・高さ中央配置、選択透明PNG、全体PNG、個別一括保存、テンプレート往復、自動保存・確認後復元 |
| Phase 1.1回帰 | PASS | 124/400/0/-15/1.25の逐次入力、Escape、背景角度-1.5、中央揃え3種類、影opacity、新規1080×1920、全キャンバスプリセット |
| B 部分色/サイズ/字間/太字 | PASS | 一部だけ赤、サイズ150px、字間25px、太字ON/OFF。PNG上の赤・青画素を検出 |
| B 全体との競合 | PASS | 全体色変更後も部分色保持。全体サイズ・字間・太字変更後も、部分指定の赤文字の実画素寸法が保持されることを確認 |
| B 保存/編集 | PASS | テンプレート読込前後の透明PNGバイト一致。範囲Undo/Redo、絵文字UTF-16、改行、前方挿入の範囲追従、範囲解除 |
| C グラデーション | PASS | 単色切替・開始/終了色・角度0/90、PNGの黄/橙画素と角度差、テンプレート往復PNGバイト一致 |
| D 影opacity | PASS | 0/50/100%で画面値が変わり、PNGのalpha量が増加。50%のテンプレート復元 |
| E SNSガイド | PASS | Instagramリール/Threads/Shorts/X、ON/OFF、pointer-events:none、表示中ドラッグ、中央ガイド維持。4種類ともガイドOFFとPNGがバイト一致 |
| F PNG背景 | PASS | 参考画像2を通常ファイル入力で読込、背面表示、左右/上下余白、追加角度-1.5、一体ドラッグ・拡縮・回転、両PNG、テンプレート |
| F SVG背景 | PASS | テスト生成の汎用パス/グラデーションSVG読込、PNGと別オブジェクトで併存、一体変形、透明PNG、全体PNG、テンプレート・復元 |
| F 背景プリセット | PASS | 保存・再適用・適用Undo/Redo・削除、削除後も配置背景保持、ページ再読込後も保存済み一覧を保持 |
| F 安全性 | PASS | ローカルPNG読込時の外部送信0、外部参照SVG拒否・外部要求0、キャッシュ済み寸法改変テンプレート拒否 |
| A/F 復元 | PASS | 部分/gradient/影/PNG/SVG/ガイドの保存値が完全一致。全PNG寸法一致、差分157チャンネル、最大2/255（輪郭の微小差） |
| A 旧データ移行 | PASS | 別ブラウザコンテキストで実際にIndexedDB v1を作成し、v2へ更新後、既存2テキストの作業を確認ダイアログから復元 |
| G UI整合性 | PASS | 5操作すべてのLucideクラス・表示名・aria-labelが一致。両場所でhoverとキーボードfocus時の日本語tooltipを確認 |

基準: テンプレート往復とガイドON/OFFはPNGバイトを比較。ブラウザ再読込をまたぐ復元は保存値の完全一致に加え、PNGを復号して寸法・画素差を検査しました。最終実行で復元差分はRGBA計8,294,400チャンネル中157、最大2/255でした。完全バイト一致とは報告していません。

Fabric Canvas内部はDOMだけでは部分色・背景・影を判定できません。そのためスクリーンショットの視覚確認、モデルを含むダウンロードJSON、実PNGの寸法・透明度・色画素・復元前後比較を併用しました。完全な全端末視覚一致を保証するものではありません。

品質コマンド（各終了コード0）:

| コマンド | 結果 |
| --- | --- |
| npm run lint | PASS |
| tsc --noEmit | PASS |
| npm run build | PASS |
| npm run build:netlify | PASS |
| npm run test:browser | PASS: 22グループ |
| npm run test:browser:phase2 | PASS: 16グループ |

ビルドにはVinext/Nitro由来の大きいchunk、optional依存のtraceInclude、Windowsネイティブ依存に関する警告があります。Netlify本番へ配信しての動作検証はしていません。

生の結果: [Phase 1回帰](../test-results/phase1-browser-results.json)、[Phase 2](../test-results/phase2/results.json)。

### スクリーンショットと出力画像

画像はローカルのtest-results配下にあり、参考画像も含めGitへ追加していません。

| 画面 | 証跡 |
| --- | --- |
| 初期画面・既存黄色背景ON | [01](../test-results/phase2/01-initial.png) |
| 部分スタイル | [02](../test-results/phase2/02-partial-styles.png) |
| グラデーション・フチ・影 | [03](../test-results/phase2/03-gradient.png) |
| 参考PNG読込・透明出力前 | [04](../test-results/phase2/04-png-background-before-export.png) |
| 透明PNG出力後 | [05](../test-results/phase2/05-png-background-after-export.png) |
| 背景との一体変形 | [06](../test-results/phase2/06-image-group-transformed.png) |
| 複数テキスト・別々のPNG/SVG | [07](../test-results/phase2/07-multiple-png-svg-backgrounds.png) |
| SNSガイド | [08](../test-results/phase2/08-social-guide.png) |
| 出力UI | [09](../test-results/phase2/09-unified-export-ui.png) |
| レイヤー | [10](../test-results/phase2/10-layers.png) |
| 復元後 | [11](../test-results/phase2/11-restored.png) |
| 旧IndexedDB移行後 | [12](../test-results/phase2/12-legacy-db-migration.png) |

実出力: [背景付き透明PNG](../test-results/phase2/png-background-transparent.png)、[全体PNG](../test-results/phase2/png-background-canvas.png)、[SVG背景PNG](../test-results/phase2/svg-background.png)、[部分スタイルPNG](../test-results/phase2/partial-styles.png)。

## 6. 既知の制限

- Windows Edgeでのローカル実ブラウザ試験です。他OS・Safari/Firefox・公開Netlify版は未検証。
- 部分編集はtextareaの範囲指定で、Canvas内の直接リッチテキスト編集ではありません。挿入・置換文字は全体設定へ戻ります。
- グラデーションUIは全体の開始/終了色と角度のみ。範囲グラデーション、中間ストップの追加UIはなし。
- SVGは安全な静的図形に限定。外部参照・script・文字・埋込画像・アニメーション・style要素を拒否します。SVGはPNG化され、パス編集と無制限のベクター拡大には非対応。
- 背景は文字寸法＋余白へ縦横伸縮します。元の縦横比を固定せず、内部透明余白や微小筆跡は保持します。12MB・合計1600万画素まで。
- SNSガイドはアプリ独自の配置目安であり、端末やSNSのUI変更に対する公式の安全保証ではありません。
- フォントは端末に依存します。復元前後のPNGに微小なアンチエイリアス差が残る場合があります。
- プリセット保存・削除自体はキャンバス履歴の対象外です。適用は履歴対象です。
- IndexedDB容量・保持期間はブラウザ依存。サイトデータ削除時は失われます。新形式の古いアプリへの逆互換性は保証しません。
- 高度な背景生成パラメーター、複数選択、外部保存、ログインは実装していません。

## 7. Phase 3でやるとよい候補

1. 範囲ごとの適用スタイル一覧・現在値表示、より分かりやすい選択ハイライト。
2. 画像背景のfit方式（伸縮/比率維持）の選択、プリセット検索・並び替え。
3. 全プロジェクトJSON保存・読込、画像資産の共通化、ZIP出力。
4. SNSガイドの端末別検証とユーザー調整、Chrome以外のブラウザ試験。
5. 複数選択・整列・スナップ。本格的な背景生成は別の明確なスコープで着手。

