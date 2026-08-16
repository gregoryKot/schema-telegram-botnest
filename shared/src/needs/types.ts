/**
 * Типы контента пяти базовых потребностей — общие для webapp и schema-miniapp
 * (правило №3 CLAUDE.md). Сам текст — в shared/src/needs/content/*, сборка —
 * в shared/src/needs/needData.ts.
 */

/** Резолвер формы обращения: tr('ты-текст', 'вы-текст'). */
export type Tr = (ty: string, vy: string) => string;

export const NEED_ORDER = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
] as const;
export type NeedId = (typeof NEED_ORDER)[number];

export interface NeedExtra {
  name: string;
  short: string;
  subtitle: string;
  emoji: string;
  hint: string;
  desc: string;
  tags: string[];
  question: string;
  examples: string[];
  /** Глубокие вопросы для рефлексии (1-е лицо, форма-агностичные). */
  reflection: string[];
  ranges: [
    { label: string; description: string },
    { label: string; description: string },
    { label: string; description: string },
  ];
  explanation: string;
  actions: string[];
  tips: {
    low: string[];
    medium: string[];
    high: string[];
  };
}

export type NeedDataMap = Record<string, NeedExtra>;
