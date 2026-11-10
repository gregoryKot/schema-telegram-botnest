import { MODE_GROUPS } from '../../schemaTherapyData';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { MapFold } from './MapFold';

interface Props {
  myModeIds: string[];
  onOpenMode: (id: string) => void;
  /** Внутри сворачиваемого «Все режимы» заголовок не нужен — он на кнопке. */
  hideTitle?: boolean;
}

/** «Карта режимов»: все режимы по группам — аккордеоны на бумаге группы со знаком группы (как у
 *  терапевта); отмеченные пользователем — с галочкой. */
export function ModeMap({ myModeIds, onOpenMode, hideTitle }: Props) {
  return (
    <section className="cs-block">
      {!hideTitle && <h3 className="ds-h3">Карта режимов</h3>}
      <div className="cs-mapfolds">
        {MODE_GROUPS.map(group => (
          <MapFold
            key={group.id} look={modeGroupLook(group.id)} title={group.group} onOpen={onOpenMode}
            tiles={group.items.map(m => ({ id: m.id, name: m.name, desc: m.short, isMine: myModeIds.includes(m.id) }))}
          />
        ))}
      </div>
    </section>
  );
}
