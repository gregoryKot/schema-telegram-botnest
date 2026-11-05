import type { ReactNode } from 'react';
import type { Section } from '../../components/appShell/navigation';
import { useTherapyTarget } from '../../components/therapy/useTherapyTarget';
import { useTherapyBridgeTexts } from '../../components/therapy/useTherapyBridgeTexts';

export interface Row { id: string; title: string; sub: string; onClick: () => void; href?: string; phoneOnly?: boolean }

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

/** Строки «Ещё»: порядок и подписи — docs/design/CLIENT_SIMPLE_2026-10.md. Без значков: картинка — крупный акцент, одна на экран (владелец 2026-11-05). */
export function useMoreRows(d: MoreRowsDeps): { rows: Row[]; sheet: ReactNode } {
  const bridge = useTherapyBridgeTexts();
  const target = useTherapyTarget('more');
  // Терапевту строка «поговорить» не нужна. Подключён терапевт — сразу ссылка на него, иначе лист «Поговорить с кем-то».
  const talkRow: Row[] = d.userRole === 'THERAPIST' || target.hidden
    ? []
    : target.write
      ? [{ id: 'talk', title: bridge.moreWriteTitle, sub: bridge.moreWriteSub, href: target.write.url, onClick: target.write.onClick }]
      : [{ id: 'talk', title: bridge.moreTalkTitle, sub: bridge.moreTalkSub, onClick: target.open }];
  const rows: Row[] = [
    { id: 'why', title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: d.onOpenWhy },
    { id: 'tasks', title: 'Задания', sub: 'От терапевта и свои цели', onClick: d.onOpenTasks },
    { id: 'schemas', title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => d.onNavigate('schemas'), phoneOnly: true },
    { id: 'practice', title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => d.onNavigate('practice'), phoneOnly: true },
    { id: 'journey', title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: d.onOpenJourney },
    ...talkRow,
    ...(d.userRole === 'THERAPIST' && d.onOpenTherapistCabinet
      ? [{ id: 'cabinet', title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: d.onOpenTherapistCabinet }]
      : []),
    { id: 'test', title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => d.onOpenSchema({ startTest: true }) },
    { id: 'settings', title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: d.onOpenAdvanced },
    { id: 'profile', title: 'Профиль', sub: 'Портрет, терапевт, ближайшая встреча', onClick: () => d.onNavigate('profile'), phoneOnly: true },
  ];
  return { rows, sheet: target.sheet };
}
