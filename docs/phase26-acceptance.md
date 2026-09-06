# Phase 2.6 ローカル受入報告

検証日: 2026-09-06。対象: `http://localhost:4175/`、Windows実インストールのChrome / Edge。公開Netlifyサイトにはデプロイしていません。

## 1. 実装状態

Phase 2.5の既存コードを維持して、Phase 2.6の4領域を拡張しました。PC停止後はgit status、差分、未追跡ファイル、書き込み状態を確認して再開。既に確定していた背景の多段補間の調査は引き継ぎ、最初から作り直していません。

## 2. 主な変更ファイル

| 領域 | ファイル |
| --- | --- |
| 色UI | `src/components/controls/ColorField.tsx`, `ColorPickerPopover.tsx` |
| 全体・部分フチUI | `src/components/panels/StrokeEditor.tsx`, `StylePanel.tsx`, `PartialStyleEditor.tsx` |
| データ・移行 | `src/types/editor.ts`, `src/services/strokes.ts`, `documentData.ts`, `styleValidation.ts`, `templateService.ts`, `persistence.ts`, `src/store/defaults.ts`, `editorStore.ts` |
| 文字描画 | `src/canvas/graphicTextRenderer.ts`, `StyledGraphicText.ts` |
| 背景品質 | `src/canvas/backgroundRenderer.ts`, `src/services/textBackgroundAssets.ts` |
| 描画・出力前の画像準備 | `src/canvas/FabricCanvas.tsx`, `src/services/exportService.ts` |
| SNSガイド | `src/canvas/SocialGuideOverlay.tsx`, `src/components/panels/ExportPanel.tsx`, `app/globals.css` |
| 試験・説明 | `scripts/phase26-browser-check.mjs`, `phase26-quality.mjs`, `phase26-svg-check.mjs`, 既存回帰スクリプト、`package.json`, `README.md` |

既存3試験の変更は、新名称・折りたたみ・カラーポップオーバーへの操作追従と、非同期プリセット読込完了待ちです。既存63グループの数、検証機能、PNG一致の判定条件は維持しています。

## 3. カラーパレットUI構造

通常のColorFieldはスウォッチとHEXだけ。共通ColorPickerPopover内に小さい6色チップを横一列、自由色選択、HEX入力をまとめました。PaletteEditorは6色を登録する設定用として維持しています。既存の色を変えず、チップ選択時の色を対象へ適用します。

Enterで開き、Escapeで閉じてスウォッチへフォーカスを戻せます。自由色選択にはブラウザの色選択コントロールを使用しています。HEXは直接入力も可能です。

## 4. 3層フチのデータと描画

```ts
strokes: [
  { enabled: true, color: '#000000', width: 3 }, // フチ1: 内側
  { enabled: true, color: '#FFFFFF', width: 6 }, // フチ2
  { enabled: true, color: '#000000', width: 4 }, // フチ3: 外側
]
```

有効な層だけの累積幅×2をCanvasの中心線stroke幅に使用。フチ3→2→1→文字塗りの順で描き、塗りは1回だけです。3層の輪郭と塗りを内側Groupへ合成し、そのシルエットに影を1回付けます。外側のGraphicText Groupによる選択・移動・拡縮・回転は維持しています。

OFFの層の幅は累積へ入れません。3/2/1/0層へ切り替えたPNGの外形を確認し、全OFFで旧幅を残した状態と幅0の状態はPNG画素が完全一致しました。

追加の連続ON仕様も反映。フチ2は1がON、フチ3は2がONのときだけONにできます。1をOFFにすると2/3、2をOFFにすると3のenabledだけをOFFにします。色・幅は削除せず、再ON時に再利用します。部分範囲では全選択文字の内側ONを確認し、選択範囲切替後の古いdraftから不連続状態を適用することも防ぎます。

## 5. legacy移行・保存

`strokes`がない旧データは、旧`stroke`をフチ1、旧`outerStroke`をフチ2、フチ3をOFFへ補完。色・幅・enabledを維持します。新形式の`strokes`を描画の正とし、旧フィールドも互換用に保持します。

ただし不連続なON状態は、外側のONを残して内側もONに正規化します（2 ON→1 ON、3 ON→1/2 ON）。部分フチでも内側ON・外側OFFの依存enabledを補完。色・幅や他の部分プロパティには触れません。Undo/Redo・テンプレート・JSON・IndexedDBで同じ正規化を使います。

アプリJSONのschemaVersionは1、IndexedDBのDBバージョンは2のまま。旧テンプレート、IndexedDB v1→v2移行、復元確認ダイアログを維持しています。新形式を旧アプリへ戻す逆方向の互換は保証しません。

安全な新規SVG背景には`sourceSvg: { markup, width, height, crop }`を追加。PNG fallbackデータも保存し、旧PNG化済みSVGを引き続き読みます。原文は検証・正規化済みのローカル静的SVGのみで、外部URL／blob URLを保存しません。PNG＋原文を含められるようテンプレート読込の上限を64MBにしています。

## 6. 部分フチの優先順位

```ts
partialStyles: [
  { start: 0, end: 2, strokes: { '1': { color: '#FF0000', width: 3 } } },
  { start: 0, end: 2, strokes: { '1': { color: '#000000' } } },
]
```

後の適用で変わるのはフチ1のcolorだけで、width=3は残ります。`enabled/color/width`をleaf単位にマージし、`false`と`0`も明示値として扱います。未指定項目は既存部分指定→全体指定を継承。fill・gradient・font・size・spacing・glyphScale・weightの既存差分上書きを維持しています。

enabledの変更だけは、追加依頼に従って内側ON／外側OFFの依存関係も同じ操作で更新します。外側ONの部分指定には必要な内側ONを保存するため、後から全体設定が変わっても部分フチが不連続になりません。部分フチがある文字では全ての塗り・輪郭を同じ文字単位で描画し、文字ラン分割による輪郭のズレを避けます。

## 7. ぼやけの原因

旧followLinesのみ、元画像→行ごとの原寸Canvasへの縮小→回転付きCanvasへの再合成→Fabric表示という複数回の補間を通っていました。縮小で失われた細いalpha端部を、後段の拡大で戻せない経路でした。CSS filterで見せかけのシャープ化はしていません。

## 8. 画質改善

- 行ごとの中間Canvasを廃止。元画像から回転込みの合成Canvasへ直接3-slice描画。
- 通常2〜4倍。外側scale・対象boundsから決め、長辺4096px、合計4MPで制限。
- 左右キャップの縦横比を保ち、短い中央部はクロップ優先。長い中央のみ伸ばす。
- 高品質補間＋元画素のオーバーラップ。目視で見つかったclip境界の淡い縦線も解消。
- 安全な新SVGを必要解像度で再描画。作業bitmapは1枚8MP、キャッシュ合計16MP。
- SVGは過去最大の描画サイズに依存させず現在設定で生成。準備直後にFabric生成し、複数SVGの準備中に退避される問題を防止。

## 9. 固定 vs 自動追従の比較

同じ参考ブラシPNGを通常ファイル入力から読み込み、同じ論理高さ121.4px・出力倍率3で比較しました。旧経路は試験コード内で再現し、アプリには残していません。

| 経路 | alpha edge MAE | 遷移画素数 |
| --- | ---: | ---: |
| 固定背景 | 0.129 | 6,893 |
| Phase 2.5相当の旧自動追従 | 38.029 | 14,089 |
| Phase 2.6自動追従 | 3.378 | 7,233 |

基準は同じ3-slice形状を最終解像度へ直接描画した画像。輪郭±2px（24,496画素）のalpha平均絶対誤差を測定し、旧経路比約91.1%減少しました。旧と新で形状処理も異なるため、値は補間性能だけを切り離した指標ではありません。

比較画像の左右端、上下辺、細い飛び出し、透明との境界を目視確認。旧経路の丸くぼけた端に対し、新経路は細い尖りが残り、固定背景に近い見え方になりました。固定背景と完全同一の画素ではありません。

![固定・旧追従・新追従比較](../test-results/phase26/background-fixed-vs-follow.png)

## 10. SNSガイド改善

1種類のみ選択する既存UIと4SNSの領域座標を維持。薄い色面＋輪郭＋10px間隔の斜線ハッチ＋11pxラベルをDOM overlayで表示します。視認性は薄い／標準／はっきり、初期標準。ラベルをOFFにもできます。

1600×850のブラウザ、Canvas表示34%で3段階を撮影し、情報量の多い参照写真上で目視確認しました。ガイドはpointer-events:noneを維持し、表示中のドラッグとPNGのON/OFFバイト一致を確認しています。

## 11. 実ブラウザ受入結果

| 試験 | 結果 | 証跡 |
| --- | --- | --- |
| Phase 1回帰 | PASS 22/22 | `test-results/phase1-browser-results.json` |
| Phase 2回帰 | PASS 16/16 | `test-results/phase2/results.json` |
| Phase 2.5回帰 | PASS 25/25 | `test-results/phase25/results.json` |
| Phase 2.6主要追加＋連続ON | PASS 24/24 | `test-results/phase26/results.json` |
| SVG・文字描画補足 | PASS 7/7 | `test-results/phase26-svg/results.json` |

主要追加試験は複数の受入条件をグループ化しています。通常色UI、Popover、キーボード、共通色UI、旧フチ移行、別色別幅3層PNG、影3→2→1→0、黄色gradient、部分フチ、leaf後勝ち・Undo/Redo・JSON、固定/追従PNG、画質指標、複数行変形、SNS4領域、視認性と出力非混入、ガイド中ドラッグ、IndexedDB復元を実操作しました。

連続ONの追加6グループ、PNG横断走査によるフチ厚／順序確認を含みます。SVG補足は安全SVG保存、別素材からの往復、旧fallback、危険SVG4種拒否、拡大→復帰・再起動時の画素一致を通常UIで操作しました。さらに実ブラウザ内の描画準備callbackで大きいSVG3種の高解像度準備を確認し、`office`の一部フチ変更時は実PNG出力中のfillText/strokeText呼出しが同じ文字単位であることを確認しています。合計は既存63＋追加31＝94グループです。

部分連続OFFのIndexedDB再起動前後は寸法一致、保存値一致、RGBA全チャネル中5値だけ最大1/255の差でした。既存回帰と同じ微小アンチエイリアス差の基準でPASSとしています。全ケースでバイトが完全一致したという意味ではありません。

## 12. 品質コマンド

`npm run lint`、`tsc --noEmit`、`npm run build`、`npm run build:netlify`はすべて終了コード0。ブラウザ試験は前記のとおりです。ビルドには大きいchunk、Vinextのdynamic import、Nitroの任意traceInclude候補についての警告が出ますが、生成は成功しています。Windowsで生成したNetlify出力をそのまま公開せず、公開時にはNetlify側の環境で再ビルドしてください。

## 13. 既知の制限

- Fabric内部の見た目はDOMだけでは判定できません。スクリーンショットと実PNG画素解析を併用しました。全フォント／全素材／全変形率の完全一致を保証するものではありません。
- 自動追従は可変対応のため形状を変えます。厳密な見本再現は固定画像背景モードを使用します。PNGに存在しない細部は復元しません。
- 大きいboundsではメモリ制限により内部倍率が下がります。キャッシュ上限は、配置済みオブジェクトを含むプロジェクト総メモリの上限ではありません。
- 旧PNG化済みSVG、non-scaling-stroke使用SVGはPNG fallback。安全な静的図形以外のSVG制限は維持。
- 実ブラウザ試験はこのWindows上のChrome / Edgeで実施。他OS・Safari/Firefoxは未検証です。
- 公開サイトは未更新。参考画像を固定アセットへ追加していません。フォントバイナリ非保存、ローカル処理の方針も維持。

## 14. Phase 3以降の候補

適用済み部分スタイルの一覧編集、背景素材に応じたキャップ位置設定、大規模プロジェクトのメモリ管理、実端末別ガイド検証。高度ブラシ形状生成・AI超解像・ZIP・複数選択・プロジェクト全体保存は今回追加していません。

## スクリーンショット一覧

すべて`test-results/phase26/`に保存しています（Git対象外）。

| 証跡 | ファイル |
| --- | --- |
| ColorPickerPopover | [01-color-picker-popover.png](../test-results/phase26/01-color-picker-popover.png) |
| フチ1/2/3 | [02-three-strokes.png](../test-results/phase26/02-three-strokes.png) |
| 黄gradient＋黒→白→黒 | [03-yellow-gradient-black-white-black.png](../test-results/phase26/03-yellow-gradient-black-white-black.png) |
| 部分3重フチ | [04-partial-three-strokes.png](../test-results/phase26/04-partial-three-strokes.png) |
| 固定／追従 | [05固定](../test-results/phase26/05-background-fixed.png)、[06追従](../test-results/phase26/06-background-follow.png) |
| 同一高さの品質比較 | [background-fixed-vs-follow.png](../test-results/phase26/background-fixed-vs-follow.png) |
| 追従背景・回転 | [07-background-rotated.png](../test-results/phase26/07-background-rotated.png) |
| SNSガイド薄い | [08-guide-light.png](../test-results/phase26/08-guide-light.png) |
| SNSガイド標準 | [08-guide-standard.png](../test-results/phase26/08-guide-standard.png) |
| SNSガイドはっきり | [08-guide-strong.png](../test-results/phase26/08-guide-strong.png) |
| IndexedDB復元 | [09-indexeddb-restored.png](../test-results/phase26/09-indexeddb-restored.png) |
| 連続ON制約の設定UI | [10-contiguous-strokes.png](../test-results/phase26/10-contiguous-strokes.png) |
| SVG復元 | [svg-restored.png](../test-results/phase26-svg/svg-restored.png) |
| 文字ランの実PNG | [office-partial-stroke.png](../test-results/phase26-svg/office-partial-stroke.png) |
