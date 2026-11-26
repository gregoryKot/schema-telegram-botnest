import type { ReactNode } from 'react';
import { SceneCabinet } from '../art/SceneCabinet';
import { glueIf } from '../../../../shared/src/utils/typo';
import '../../styles/cabinet-empty.css';

interface Props {
  title?: ReactNode;
  text: ReactNode;
  /** Главное действие пустого кабинета (кнопка «Добавить клиента» или форма добавления). */
  children?: ReactNode;
}

/** Пустой кабинет терапевта (b29, принцип 8): одна сцена SceneCabinet, заголовок, строка «что дальше» и
 *  одно действие. Одна на «Сегодня» и «Клиенты» — вместо трёх чашек подряд у нового терапевта. */
export function CabinetEmpty({ title, text, children }: Props) {
  return (
    <section className="ce-empty">
      <div className="ce-empty-scene" aria-hidden="true"><SceneCabinet /></div>
      <div className="ce-empty-body">
        {title && <h2 className="ce-empty-title">{glueIf(title)}</h2>}
        <p className="ce-empty-text">{glueIf(text)}</p>
        {children}
      </div>
    </section>
  );
}
