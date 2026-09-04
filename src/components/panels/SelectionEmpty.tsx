import { MousePointer2 } from 'lucide-react';

export function SelectionEmpty() {
  return (
    <div className="selection-empty">
      <MousePointer2 aria-hidden="true" />
      <p>テキストを選択してください</p>
      <span>キャンバスまたはレイヤー一覧から編集するテキストを選びます。</span>
    </div>
  );
}
