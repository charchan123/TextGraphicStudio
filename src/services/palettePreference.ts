import { DEFAULT_COLOR_PALETTE } from '@/src/store/defaults';
import { isColorPalette } from '@/src/services/styleValidation';
import type { ColorPalette } from '@/src/types/editor';

const STORAGE_KEY = 'text-graphic-studio-color-palette-v1';

export const loadPalettePreference = (): ColorPalette => {
  if (typeof localStorage === 'undefined') return [...DEFAULT_COLOR_PALETTE];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isColorPalette(value) ? [...value] : [...DEFAULT_COLOR_PALETTE];
  } catch {
    return [...DEFAULT_COLOR_PALETTE];
  }
};

export const savePalettePreference = (palette: ColorPalette): void => {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(palette)); } catch { /* IndexedDB autosave remains available. */ }
};
