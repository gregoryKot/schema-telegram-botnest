import type { UserId } from '../../api';
import { NEED_ORDER, getNeedData } from '../../needData';
import { Skeleton } from '../Skeleton';
import { useModeMapConcept } from './clientConceptContext';
import { useClientChildhood } from './useClientChildhood';
import { pctLabel, ratingsOf, withChildhood, type WheelData } from './needWheel';
import { needInConcept } from './wheelConcept';

// Связки колеса потребностей с остальными данными клиента (владелец 2026-11-10):
// упражнение «Колесо детства», которое клиент проходит сам, и концептуализация —
// какие схемы блокируют потребность и какой здоровый режим о ней заботится.

const NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения

/** «Колесо детства» клиента: его оценки и перенос в период «Детство» одной кнопкой. */
export function WheelChildhood({ clientId, wheel, onApply }: { clientId?: UserId; wheel: WheelData; onApply: (w: WheelData) => void }) {
  const { state, retry } = useClientChildhood(clientId);
  if (state.status === 'idle') return null;
  const ratings = state.status === 'ready' ? state.ratings : {};
  const ids = NEED_ORDER.filter((id) => ratings[id] !== undefined);
  const child = ratingsOf(wheel, 'child');
  const same = ids.every((id) => child[id] === ratings[id]);
  return (
    <div className="mm2-hint mm2-wheel-ex" aria-busy={state.status === 'loading'}>
      <div className="ds-label">«Колесо детства» клиента</div>
      {state.status === 'loading' && <Skeleton width="100%" height={14} radius={6} />}
      {state.status === 'error' && (
        <p className="mm2-hint-p">Не удалось загрузить.{' '}
          <button type="button" className="ds-link ds-link--inline" onClick={retry}>Повторить</button></p>
      )}
      {state.status === 'ready' && ids.length === 0 && (
        <p className="mm2-hint-p">Оценок нет: клиент ещё не проходил упражнение в «Практиках» или закрыл профиль от терапевта.</p>
      )}
      {ids.length > 0 && (
        <>
          <p className="mm2-hint-p">{ids.map((id) => `${NAMES[id].name} ${pctLabel(ratings[id])}`).join(' · ')}</p>
          {same ? <p className="mm2-hint-p">Уже стоит в периоде «Детство».</p> : (
            <button type="button" className="ds-btn ds-btn--secondary mm2-hint-btn" onClick={() => onApply(withChildhood(wheel, ratings))}>
              Перенести в «Детство»
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function WheelConceptLine({ needId }: { needId: string }) {
  const concept = useModeMapConcept();
  if (!concept || concept === 'failed') return null;
  const { blocks, meets } = needInConcept(concept, needId);
  return (
    <p className="mm2-hint-p mm2-wheel-concept">
      {blocks.length + meets.length === 0
        ? 'В концептуализации эта потребность пока ни с чем не связана: линия от схемы к сектору — «✗ блокирует», от Здорового Взрослого — «✓ заботится».'
        : [blocks.length && `✗ блокирует: ${blocks.join(', ')}`, meets.length && `✓ заботится: ${meets.join(', ')}`].filter(Boolean).join(' · ')}
    </p>
  );
}
