import type { ReactNode } from 'react';
import type { Section } from '../../components/appShell/navigation';
import { useTherapyTarget } from '../../components/therapy/useTherapyTarget';
import { useTherapyBridgeTexts } from '../../components/therapy/useTherapyBridgeTexts';
import { Layers } from '../../components/art/PaperArt';
import { BrandMark } from '../../components/art/BrandMark';
import { SignArt } from '../../components/art/SignArt';
import { ENTITY_LOOK, type SignKey } from '../../../../shared/src/theme/entityLook';
import { useNewTasksCount } from '../tasks/newTasks';

export interface Row {
  id: string; art?: ReactNode; title: string; sub: string; onClick: () => void; href?: string; phoneOnly?: boolean;
  /** Счётчик новых справа от заголовка (новые задания терапевта); 0 — нет. */
  badge?: number;
}

export interface MoreRowsDeps {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
  onOpenAdvanced: () => void;
  onOpenWhy: () => void;
  onOpenJourney: () => void;
  onOpenTasks: () => void;
  onOpenSelfMap: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

const sign = (key: SignKey) => <SignArt sign={key} size="row" />;
const TALK = sign(ENTITY_LOOK.therapist.sign);

/** Строки «Ещё»: порядок и подписи — docs/design/CLIENT_SIMPLE_2026-10.md; картинка слева — по таблице мотивов.
 *  Один знак — одна строка, у каждой строки знак есть (колонка заголовков ровная; сверка — useMoreRows.test.tsx):
 *  «Зачем это всё» — знак продукта, как на самом листе; тест на схемы — вариант мотива `Layers probe`,
 *  «Мои паттерны» — `Layers`, как в меню; кабинет терапевта — `Talk` (строки «Поговорить» у терапевта нет). */
export function useMoreRows(d: MoreRowsDeps): { rows: Row[]; sheet: ReactNode } {
  const bridge = useTherapyBridgeTexts();
  const target = useTherapyTarget('more');
  const newTasks = useNewTasksCount();
  // Терапевту строка «поговорить» не нужна. Подключён терапевт с каналом — сразу ссылка на него;
  // без канала — лист «Терапевт рядом» (подпись про своего терапевта, не про автора, U4); нет терапевта — «Поговорить с кем-то».
  const talkRow: Row[] = d.userRole === 'THERAPIST' || target.hidden
    ? []
    : target.write
      ? [{ id: 'talk', art: TALK, title: bridge.moreWriteTitle, sub: bridge.moreWriteSub, href: target.write.url, onClick: target.write.onClick }]
      : target.connected
        ? [{ id: 'talk', art: TALK, title: bridge.moreTherapistTitle, sub: bridge.moreTherapistSub, onClick: target.open }]
        : [{ id: 'talk', art: TALK, title: bridge.moreTalkTitle, sub: bridge.moreTalkSub, onClick: target.open }];
  const rows: Row[] = [
    { id: 'why', art: <BrandMark size={36} simple bare className="cm-why-sign" />, title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: d.onOpenWhy },
    { id: 'tasks', art: sign('check'), title: 'Задания', sub: 'От терапевта и свои цели', onClick: d.onOpenTasks, badge: newTasks },
    { id: 'schemas', art: sign('layers'), title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => d.onNavigate('schemas'), phoneOnly: true },
    // Единственный постоянный вход в «Карту себя»: иначе её видно только после разбора (CaseDoneScreen).
    { id: 'selfmap', art: sign('cluster'), title: 'Карта себя', sub: 'Из разборов: какие части включаются в трудные моменты', onClick: d.onOpenSelfMap },
    { id: 'practice', art: sign('breath'), title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => d.onNavigate('practice'), phoneOnly: true },
    { id: 'journey', art: sign('sheets'), title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: d.onOpenJourney },
    ...talkRow,
    ...(d.userRole === 'THERAPIST' && d.onOpenTherapistCabinet
      ? [{ id: 'cabinet', art: TALK, title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: d.onOpenTherapistCabinet }]
      : []),
    { id: 'test', art: <Layers size="row" probe />, title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => d.onOpenSchema({ startTest: true }) },
    { id: 'settings', art: sign('beads'), title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: d.onOpenAdvanced },
    { id: 'profile', art: sign(ENTITY_LOOK.profile.sign), title: 'Профиль', sub: 'Портрет, терапевт, ближайшая встреча', onClick: () => d.onNavigate('profile'), phoneOnly: true },
  ];
  return { rows, sheet: target.sheet };
}
