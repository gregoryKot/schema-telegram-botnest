// Стили листов подсказок терапевту (#995): колонка чтения и абзац справочника.
import type { CSSProperties } from 'react';

export const guideTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.6,
  color: 'var(--text)',
  whiteSpace: 'pre-line',
};

/** Ширина колонки листа подсказок на планшете (на телефоне лист уже, на компьютере — панель справа): строка ~70 знаков, а не во всю ширину окна. */
export const GUIDE_COLUMN = 680;

