'use client';

import { useEditorStore } from '@/src/store/editorStore';

export function PaletteEditor() {
  const palette = useEditorStore((state) => state.project.palette);
  const setPaletteColor = useEditorStore((state) => state.setPaletteColor);
  return (
    <section className="panel-section palette-editor" aria-labelledby="palette-heading">
      <div className="section-heading">
        <div>
          <h2 id="palette-heading">カラーパレット設定</h2>
          <p>よく使う6色を、すべての色設定ですぐ選べます</p>
        </div>
      </div>
      <div className="palette-editor-grid">
        {palette.map((color, index) => (
          <label key={index} className="palette-editor-swatch">
            <span>色 {index + 1}</span>
            <input
              type="color"
              value={color}
              aria-label={`パレット色 ${index + 1}`}
              onChange={(event) => setPaletteColor(index, event.currentTarget.value)}
            />
            <code>{color}</code>
          </label>
        ))}
      </div>
    </section>
  );
}
