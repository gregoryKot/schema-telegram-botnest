import type { ReactNode } from 'react';
import { PaperEmpty } from '../../components/art/PaperEmpty';
import { useTr } from '../../utils/addressForm';
import { MineGroupsSkeleton } from './MineGroupsSkeleton';
import { MyModesList } from './MyModesList';
import { ModeMap } from './ModeMap';
import { MODE_WHAT } from '../../../../shared/src/pattern/patternTerms';

interface Props {
  loading: boolean; myModeIds: string[]; onAdd: () => void; onOpenMode: (id: string) => void;
  modeFreq?: Record<string, number>; // дней за неделю по дневнику; undefined — пока не загрузилось
  statusFor?: (id: string) => string; // статус карточки словами; undefined — пока грузится
  onOpenPattern: (id: string) => void; // строка «Мои режимы» → экран паттерна; плитки карты → onOpenMode
  /** Сбой сохранения выбора — строкой у блока, где выбор сделан. */
  note?: ReactNode;
  /** «Карта режимов с терапевтом» — между своими режимами и картой всех (как на телефоне). */
  banner?: ReactNode;
}

/** Компьютер: «Мои режимы» группами на бумаге группы (как на телефоне) и «Карта режимов» — все режимы
 *  по группам; пусто — что такое режим. */
export function ModesBlocks({ loading, myModeIds, onAdd, onOpenMode, onOpenPattern, modeFreq, statusFor, note, banner }: Props) {
  const tr = useTr();
  return (
    <>
      <section className="cs-block">
        <div className="ds-head-row">
          <h3 className="ds-h3">Мои режимы</h3>
          <button onClick={onAdd} className="ds-link">+ Добавить</button>
        </div>
        {note}
        {loading ? <MineGroupsSkeleton /> : myModeIds.length === 0 ? (
          <PaperEmpty>{MODE_WHAT} {tr('Добавь режимы, которые узнаёшь у себя.', 'Добавьте режимы, которые узнаёте у себя.')}</PaperEmpty>
        ) : (
          <MyModesList loading={false} ids={myModeIds} onAdd={onAdd} onOpenMode={onOpenPattern} statusFor={statusFor} freq={modeFreq} withAdd={false} />
        )}
      </section>
      {banner}
      <ModeMap myModeIds={myModeIds} onOpenMode={onOpenMode} />
    </>
  );
}
