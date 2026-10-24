import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqTherapyCta } from '../../../../shared/src/components/YsqTherapyCta';
import { YsqResultTopBar } from '../../../../shared/src/components/YsqResultTopBar';
import { YsqSyncErrorNote } from '../../../../shared/src/components/YsqSyncErrorNote';
import { api } from '../../api';
import type { contactCta } from '../../utils/therapistContact';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { ResultView, SchemaInfo, SchemaScore, YsqHistoryEntry } from '../../hooks/useYsqTest';
import { YsqSchemaCard } from './YsqSchemaCard';
import { YsqInactiveList, YsqHistory } from './YsqExtras';
import { SsHead } from '../schemaSheets/SsSheet';

type Tr = (ty: string, vy: string) => string;
type Cta = ReturnType<typeof contactCta>;

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
  onShare: () => void;
  onOpenSchema: (name: string) => void;
  onDone: () => void;
}

/** Экран результатов теста YSQ: выраженные схемы по доменам, остальные, история, действия. */
export function YsqResult(p: Props) {
  const { inactiveSchemas, activeByDomain, dateLabel, activeCount, activeLabel, getSchemaDelta } = p.view;
  return (
    <>
      {p.resultSaveError && p.retrySaveResult && <YsqSyncErrorNote variant="result-save" onRetry={p.retrySaveResult} />}
      {/* «Как понимать» + «Поделиться» — с самого верха (правило онбординга) */}
      <YsqResultTopBar tr={p.tr} onShare={p.onShare} onHelpOpen={() => api.trackEvent('ysq_help_open')} />

      <SsHead title={activeLabel} lede={dateLabel ? `Пройдено ${dateLabel}` : undefined} />

      {activeCount === 0 && <p className="ss-body">Выраженных схем нет — отличный результат.</p>}

      {activeByDomain.map(domain => (
        <div key={domain.needId} className="ss-res" style={hueStyle(NEED_HUE[domain.needId as NeedId])}>
          <div className="ds-chip tone-tint" style={{ alignSelf: 'flex-start' }}>{domain.label}</div>
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
                delta={getSchemaDelta(schema.name)}
                diaryRating={p.ratings?.[schema.needId]}
                onOpen={() => p.onOpenSchema(schema.name)}
              />
            );
          })}
        </div>
      ))}

      {inactiveSchemas.length > 0 && (
        <YsqInactiveList schemas={inactiveSchemas} scores={p.scores} expanded={p.inactiveExpanded} onToggle={p.onToggleInactive} />
      )}

      {/* CTA — общий компонент (shared, правило №3), клик трекается
          (правило №8, place 'ysq_result'). Прячем целиком, если сам
          пользователь терапевт (isSelf): «Написать вам» бессмысленно. */}
      {activeCount > 0 && !p.cta.isSelf && (
        <YsqTherapyCta cta={p.cta} tr={p.tr} onLinkClick={() => api.trackPublicEvent('practice_link_click', { place: 'ysq_result' })} />
      )}

      {p.history.length >= 2 && <YsqHistory history={p.history} />}

      <div className="ss-actions">
        <button onClick={p.onDone} className="ds-btn">Сохранить и закрыть</button>
        {p.retakeConfirm ? (
          <div className="ss-confirm">
            <div>Результаты будут удалены. Точно начать заново?</div>
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
