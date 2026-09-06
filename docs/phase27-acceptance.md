# Phase 2.7 受入試験

## 実装範囲

- 既存 `characterScale` をUnicode grapheme分類とFabric文字別 `fontSize` へ接続
- 記号倍率を追加し、旧データでは100%へ補完
- 最後に変更した全体デザインをIndexedDBへ独立保存し、新規テキストへ適用
- 固定／自動追従テキスト背景へローカル座標のX/Y Offsetを追加
- 部分フチを「変更しない／全体設定を使用／この範囲でON・OFF・変更」の操作モデルへ変更

## 結果

- Phase 2.7 Chrome試験: 14グループ PASS
- Phase 1回帰: 22グループ PASS
- Phase 2回帰: 16グループ PASS
- Phase 2.5回帰: 25グループ PASS
- Phase 2.6回帰: 24グループ PASS
- Phase 2.6 SVG回帰: 7グループ PASS
- Chromeネイティブカラーピッカー回帰: 5グループ PASS
- `npm run lint`: PASS
- `tsc --noEmit`: PASS
- `npm run build`: PASS
- `npm run build:netlify`: PASS

Phase 2.7の証跡とJSON結果は `test-results/phase27/` に生成されます。公開サイトへのデプロイは実施していません。
