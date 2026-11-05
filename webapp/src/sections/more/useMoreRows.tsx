import type { ReactNode } from 'react';
import type { Section } from '../../components/appShell/navigation';
import { useTherapyTarget } from '../../components/therapy/useTherapyTarget';
import { useTherapyBridgeTexts } from '../../components/therapy/useTherapyBridgeTexts';
import { Breath, Layers, Pebbles, Sheets } from '../../components/art/PaperArt';
import { Beads, Check, Leaf, Talk } from '../../components/art/PaperArtSigns';

export interface Row { id: string; art?: ReactNode; title: string; sub: string; onClick: () => void; href?: string; phoneOnly?: boolean }

export interface MoreRowsDeps {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
  onOpenAdvanced: () => void;
  onOpenWhy: () => void;
  onOpenJourney: () => void;
  onOpenTasks: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

/** Строки «Ещё»: порядок и подписи — docs/design/CLIENT_SIMPLE_2026-10.md; картинка слева — по таблице мотивов. */
export function useMoreRows(d: MoreRowsDeps): { rows: Row[]; sheet: ReactNode } {
  const bridge = useTherapyBridgeTexts();
  const target = useTherapyTarget('more');
  // Терапевту строка «поговорить» не нужна. Подключён терапевт — сразу ссылка на него, иначе лист «Поговорить с кем-то».
  const talkRow: Row[] = d.userRole === 'THERAPIST' || target.hidden
    ? []
    : target.write
      ? [{ id: 'talk', art: <Talk size="row" />, title: bridge.moreWriteTitle, sub: bridge.moreWriteSub, href: target.write.url, onClick: target.write.onClick }]
      : [{ id: 'talk', art: <Talk size="row" />, title: bridge.moreTalkTitle, sub: bridge.moreTalkSub, onClick: target.open }];
  const rows: Row[] = [
    { id: 'why', art: <Leaf size="row" />, title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: d.onOpenWhy },
    { id: 'tasks', art: <Check size="row" />, title: 'Задания', sub: 'От терапевта и свои цели', onClick: d.onOpenTasks },
    { id: 'schemas', art: <Layers size="row" />, title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => d.onNavigate('schemas'), phoneOnly: true },
    { id: 'practice', art: <Breath size="row" />, title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => d.onNavigate('practice'), phoneOnly: true },
    { id: 'journey', art: <Sheets size="row" />, title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: d.onOpenJourney },
    ...talkRow,
    ...(d.userRole === 'THERAPIST' && d.onOpenTherapistCabinet
      ? [{ id: 'cabinet', title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: d.onOpenTherapistCabinet }]
      : []),
    { id: 'test', art: <Layers size="row" />, title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => d.onOpenSchema({ startTest: true }) },
    { id: 'settings', art: <Beads size="row" />, title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: d.onOpenAdvanced },
    { id: 'profile', art: <Pebbles size="row" />, title: 'Профиль', sub: 'Портрет, терапевт, ближайшая встреча', onClick: () => d.onNavigate('profile'), phoneOnly: true },
  ];
  return { rows, sheet: target.sheet };
}
