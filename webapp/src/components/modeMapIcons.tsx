// Shared icon set for the Mode Map UI — one consistent line-icon family that
// replaces the ad-hoc emoji glyphs (↶ ↷ ＋ ▦ 💡 ⬇ …) in the toolbar, node
// tools, panels and read-only viewer. All icons inherit `currentColor`, so they
// pick up whatever text colour the surrounding button uses in either theme.
//
// Usage: <MMIcon name="undo" /> · size defaults to 18, stroke to 1.7.

import type { CSSProperties } from 'react';

export type IconName =
  | 'undo' | 'redo' | 'minus' | 'plus' | 'fit' | 'auto' | 'grid' | 'zones'
  | 'layers' | 'bulb' | 'info' | 'download' | 'keyboard' | 'caret'
  | 'sparkle' | 'close' | 'search' | 'edit' | 'copy' | 'trash' | 'swap'
  | 'image' | 'file' | 'compass' | 'target' | 'map' | 'refresh' | 'reverse';

// Each entry is the inner markup of a 0 0 24 24 viewBox.
const PATHS: Record<IconName, string> = {
  undo:    'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H10',
  redo:    'm15 14 5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H14',
  minus:   'M5 12h14',
  plus:    'M12 5v14 M5 12h14',
  fit:     'M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M3 16v3a2 2 0 0 0 2 2h3',
  auto:    'm12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18 15l.7 1.8L20.5 17l-1.8.7L18 19.5l-.7-1.8L15.5 17z',
  grid:    'M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  zones:   'M4 6h16 M4 12h16 M4 18h16',
  layers:  'm12 3 8.5 4.7L12 12.4 3.5 7.7 12 3z M3.5 12 12 16.7 20.5 12 M3.5 16.3 12 21l8.5-4.7',
  bulb:    'M9.5 18h5 M10.5 21.5h3 M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5 1 1.2 1.1 2h5.4c.1-.8.5-1.5 1.1-2A6.5 6.5 0 0 0 12 2.5z',
  info:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16v-4.5 M12 8h.01',
  download:'M12 3v11 M7.5 9.5 12 14l4.5-4.5 M5 20h14',
  keyboard:'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10',
  caret:   'm6 9 6 6 6-6',
  sparkle: 'm12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  close:   'M6 6l12 12 M18 6 6 18',
  search:  'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z m9 2-3.2-3.2',
  edit:    'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  copy:    'M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M5 15V5a2 2 0 0 1 2-2h8',
  trash:   'M4 7h16 M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13',
  swap:    'M7 4 3 8l4 4 M3 8h13a4 4 0 0 1 0 8h-1 M17 20l4-4-4-4',
  image:   'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6',
  file:    'M7 3h7l5 5v13H7z M14 3v5h5',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z m4-13-2.5 5.5L8 16l2.5-5.5z',
  target:  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  map:     'm9 4-6 2.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4.5z M9 4.5v12.5 M15 7v12.5',
  refresh: 'M20 11a8 8 0 1 0-.6 4 M20 5v6h-6',
  reverse: 'M9 5 4 9l5 4 M4 9h11a5 5 0 0 1 0 10h-2',
};

// Some glyphs read better with a slightly thinner/rounder stroke.
const THIN: Partial<Record<IconName, number>> = { minus: 1.9, plus: 1.9, caret: 2, close: 1.9, zones: 1.9 };

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}

export function MMIcon({ name, size = 18, stroke, style }: Props) {
  const sw = stroke ?? THIN[name] ?? 1.7;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
