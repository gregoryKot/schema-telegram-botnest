import type { ReactNode } from 'react';
import { Sign } from './SignArt';
import { TaskSign } from '../../sections/practice/TaskSign';
import type { UserTask } from '../../api';
import '../../styles/therapist-tabs.css';

// Бумажная аппликация кабинета терапевта (docs/design/PAPER_2026-11.md): мотив
// строки рядом с заголовком вкладки по смыслу — заметки, задания, тест YSQ.
export type TabMotif = 'pebbles' | 'check' | 'layers';

export function TabArt({ motif }: { motif: TabMotif }) {
  return <Sign kind={motif} className="tb-tab-art" />;
}

/** Знак строки задания по его типу (TaskSign). */
export const TaskArt = ({ task }: { task: Pick<UserTask, 'type' | 'text'> }) => <span className="pp-row-art"><TaskSign task={task} /></span>;

// Заголовок вкладки карточки клиента: h2 и подпись. Показывается на компьютере
// (≥768, как до волн #906); на телефоне h2 прячет CSS (имя вкладки уже наверху).
// className `tb-tab-title--desk` прячет на телефоне весь блок, если подписи там нет.
export function TabTitle({ title, className = '', motif, children }: { title: string; className?: string; motif?: TabMotif; children?: ReactNode }) {
  const head = (
    <>
      <h2 className="ds-h2 tb-tab-h">{title}</h2>
      {children}
    </>
  );
  if (!motif) return <div className={`tb-tab-title ${className}`.trim()}>{head}</div>;
  return (
    <div className={`tb-tab-title tb-tab-title--art ${className}`.trim()}>
      <TabArt motif={motif} />
      <div>{head}</div>
    </div>
  );
}
