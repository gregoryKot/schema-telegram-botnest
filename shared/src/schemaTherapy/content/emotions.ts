import type { Emotion } from '../types';

// Единственный источник контента схема-терапии (правило №3 CLAUDE.md):
// раньше дублировался построчно в webapp/src/schemaTherapyData.ts и
// schema-miniapp/src/schemaTherapyData.ts, оба фронтенда берут его отсюда.

// ─── Emotions (Plutchik + ST-relevant) ─────────────────────────────────────

export const EMOTIONS: Emotion[] = [
  { id: 'fear', label: 'Страх', emoji: '😨' },
  { id: 'anxiety', label: 'Тревога', emoji: '😰' },
  { id: 'sadness', label: 'Грусть', emoji: '😔' },
  { id: 'shame', label: 'Стыд', emoji: '😳' },
  { id: 'guilt', label: 'Вина', emoji: '😕' },
  { id: 'anger', label: 'Злость', emoji: '😠' },
  { id: 'disgust', label: 'Отвращение', emoji: '🤢' },
  { id: 'joy', label: 'Радость', emoji: '😊' },
  { id: 'trust', label: 'Доверие', emoji: '🤗' },
  { id: 'surprise', label: 'Удивление', emoji: '😲' },
  { id: 'anticipation', label: 'Ожидание', emoji: '🤔' },
  { id: 'apathy', label: 'Апатия', emoji: '😶' },
];

export const INTENSITY_LABELS = [
  'чуть-чуть',
  'заметно',
  'сильно',
  'очень',
  'невыносимо',
];
