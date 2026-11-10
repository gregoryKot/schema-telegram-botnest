import type { CSSProperties } from 'react';
import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqTherapyCta } from '../../../../shared/src/components/YsqTherapyCta';
import { YsqSyncNote } from './YsqSyncNote';
import { api } from '../../api';
import type { contactCta } from '../../utils/therapistContact';
import { NEED_HUE } from '../../lib/tone';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { ResultView, SchemaInfo, SchemaScore, YsqHistoryEntry } from '../../hooks/useYsqTest';
import { inkVars } from '../history/needInk';
import { SignHero } from '../paper/SignHero';
import { YsqNeedHead } from './YsqNeedHead';
import { YsqSchemaCard } from './YsqSchemaCard';
import { YsqInactiveList, YsqHistory } from './YsqExtras';

type Tr = (ty: string, vy: string) => string; type Cta = ReturnType<typeof contactCta>;

interface Props {
  tr: Tr;
  scores: Record<string, SchemaScore>;
  view: ResultView;
  ysqSchemas: SchemaInfo[];
  history: YsqHistoryEntry[];
  ratings?: Record<string, number>;
  cta: Cta;
  resultSaveError?: boolean;
  retrySaveResult?: () => void;
  inactiveExpanded: boolean;
  onToggleInactive: () => void;
  retakeConfirm: boolean;
  onRetakeConfirm: (v: boolean) => void;
  onRetake: () => void;
  onOpenSchema: (name: string) => void;
  onDone: () => void;
}

/** Экран результатов теста YSQ: выраженные схемы по потребностям — лист бумаги потребности со знаком,
 *  карточки схем белые; остальные, история, действия. Герой и «Как понимать» — YsqResultHero
 *  (колонкой слева на компьютере). Полоска балла — цвет данных потребности (решение 7). */
export function YsqResult(p: Props) {
  const { inactiveSchemas, activeByDomain, activeCount } = p.view;
  return (
    <>
      {p.resultSaveError && p.retrySaveResult && <YsqSyncNote variant="result-save" onRetry={p.retrySaveResult} />}

      {activeCount === 0 && <p className="ss-body">Выраженных схем нет — отличный результат.</p>}

      {activeByDomain.map(domain => (
        <section key={domain.needId} className="pp-paper ss-res"
          style={{ '--h': NEED_HUE[domain.needId as NeedId], ...inkVars(domain.needId) } as CSSProperties}>
          <YsqNeedHead needId={domain.needId} label={domain.label} />
          {domain.schemas.map(schema => {
            const s = p.scores[schema.name];
            return (
              <YsqSchemaCard
                key={schema.name}
                schema={schema}
                avg={s.avg}
                n5plus={s.n5plus}
                nQuestions={s.nQuestions}
                tip={p.ysqSchemas.find(sc => sc.name === schema.name)?.tip ?? schema.tip}
                delta={p.view.getSchemaDelta(schema.name)}
                diaryRating={p.ratings?.[schema.needId]}
                onOpen={() => p.onOpenSchema(schema.name)}
              />
            );
          })}
        </section>
      ))}

      {inactiveSchemas.length > 0 && (
        <YsqInactiveList schemas={inactiveSchemas} scores={p.scores} expanded={p.inactiveExpanded} onToggle={p.onToggleInactive} />
      )}

      {/* CTA — общий компонент (shared, правило №3), клик трекается
          (правило №8, place 'ysq_result'). Прячем целиком, если сам
          пользователь терапевт (isSelf): «Написать вам» бессмысленно. */}
      {activeCount > 0 && !p.cta.isSelf && (
        <YsqTherapyCta cta={p.cta} tr={p.tr} art={<SignHero sign={ENTITY_LOOK.therapist.sign} />}
          onLinkClick={() => api.trackPublicEvent('practice_link_click', { place: 'ysq_result' })} />
      )}

      {p.history.length >= 2 && <YsqHistory history={p.history} />}

      <div className="ss-actions ss-actions--wide">
        <button onClick={p.onDone} className="ds-btn">Сохранить и закрыть</button>
        {p.retakeConfirm ? (
          <div className="pp-paper ss-confirm">
            <div>Прошлый результат останется в истории, новый появится после последнего вопроса.</div>
            <div className="ss-actions ss-actions--row">
              <button onClick={() => p.onRetakeConfirm(false)} className="ds-btn ds-btn--secondary">Отмена</button>
              <button onClick={p.onRetake} className="ds-btn ds-btn--accent">Начать заново</button>
            </div>
          </div>
        ) : (
          <button onClick={() => p.onRetakeConfirm(true)} className="ds-btn ds-btn--secondary">Пройти заново</button>
        )}
      </div>

      <YsqDisclaimer mt={4} />
    </>
  );
}
