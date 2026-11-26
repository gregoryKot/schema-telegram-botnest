import type { ReactNode } from 'react';
import { PaperEmpty } from '../../components/art/PaperEmpty';
import { useTr } from '../../utils/addressForm';
import { MineGroupsSkeleton } from './MineGroupsSkeleton';
import { MySchemasList } from './MySchemasList';

interface Props {
  loading: boolean;
  ids: string[];
  onAdd: () => void; onOpenSchema: (id: string) => void;
  statusFor?: (id: string) => string; // статус карточки словами; undefined — пока грузится
  freq?: Record<string, number>; // дней за неделю по дневнику; undefined — пока не загрузилось
  /** Сбой сохранения выбора — строкой у блока, где выбор сделан (SelectionSaveNote). */
  note?: ReactNode;
}

/** «Мои схемы» (компьютер): заголовок с «+ Добавить», группы на бумаге домена в колонки — та же
 *  механика, что строки телефона (MineGroupsList), а не чипы с цветной рамкой. */
export function MySchemasBlock({ loading, ids, onAdd, onOpenSchema, statusFor, freq, note }: Props) {
  const tr = useTr();
  return (
    <section className="cs-block">
      <div className="ds-head-row">
        <h3 className="ds-h3">Мои схемы</h3><button onClick={onAdd} className="ds-link">+ Добавить</button>
      </div>
      {note}
      {loading ? <MineGroupsSkeleton /> : ids.length === 0 ? (
        <PaperEmpty>{tr('Пройди тест на схемы или добавь вручную', 'Пройдите тест на схемы или добавьте вручную')}</PaperEmpty>
      ) : (
        <MySchemasList ids={ids} onAdd={onAdd} onOpenSchema={onOpenSchema} statusFor={statusFor} freq={freq} withAdd={false} />
      )}
    </section>
  );
}
