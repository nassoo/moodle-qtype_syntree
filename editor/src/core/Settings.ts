/**
 * Syntax Tree Editor: display settings.
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
/**
 * Application settings for the Syntax Tree Editor.
 * Manages user preferences for text styling, layout, colors, and behavior.
 * Persists to localStorage with automatic save on change.
 */

export interface AppSettings {
  // Text & Fonts
  labelBold: boolean;
  lexicalItalic: boolean;
  labelFontSize: number;    // px (12–30)
  lexicalFontSize: number;  // px (10–26)
  fontFamily: string;

  // Layout
  levelHeight: number;      // px (40–120)
  tokenMargin: number;      // px (10–50)
  rootMarginTop: number;    // px (10–80)

  // Colors
  labelColor: string;       // hex
  lexicalColor: string;     // hex
  lineColor: string;        // hex
  backgroundColor: string;  // hex

  // Behavior
  autoCenter: boolean;
  showPlaceholders: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  labelBold: true,
  lexicalItalic: false,
  labelFontSize: 18,
  lexicalFontSize: 16,
  fontFamily: 'system-ui, sans-serif',
  levelHeight: 70,
  tokenMargin: 20,
  rootMarginTop: 40,
  labelColor: '#ffffff',
  lexicalColor: '#cccccc',
  lineColor: '#666666',
  backgroundColor: '#21252b',
  autoCenter: false,
  showPlaceholders: true,
};

const STORAGE_KEY = 'syntaxTreeEditorSettings';

/**
 * Load settings from localStorage, merging with defaults for forward compatibility.
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge: defaults first, then saved values on top (handles new settings added later)
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Corrupted data — fall back to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage.
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

/**
 * Creates a debounced save function for slider controls.
 */
export function createDebouncedSave(delayMs: number = 300): (settings: AppSettings) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (settings: AppSettings) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveSettings(settings), delayMs);
  };
}
