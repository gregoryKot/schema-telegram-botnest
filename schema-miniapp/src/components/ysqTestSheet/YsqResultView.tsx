import { contactCta } from '../../utils/therapistContact';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { YsqDisclaimer } from '../../../../shared/src/components/YsqDisclaimer';
import { YsqResultTopBar } from '../../../../shared/src/components/YsqResultTopBar';
import { YsqActiveSchemaCard } from './YsqActiveSchemaCard';
import { YsqInactiveSchemas } from './YsqInactiveSchemas';
import { YsqTherapyCta } from './YsqTherapyCta';
import { YsqHistoryTimeline } from './YsqHistoryTimeline';
import { YsqResultActions } from './YsqResultActions';
import type { ResultView, Scores, YsqHistoryEntry } from './types';

interface Props {
  scores: Scores;
  resultView: ResultView;
  ratings?: Record<string, number>;
  history: YsqHistoryEntry[];
  inactiveExpanded: boolean;
  setInactiveExpanded: (updater: (prev: boolean) => boolean) => void;
  retakeConfirm: boolean;
  setRetakeConfirm: (v: boolean) => void;
  onViewSchemas?: (schemaName: string) => void;
  onClose: () => void;
  onShare: () => void;
  onRetake: () => void;
}

// ── Result phase ──────────────────────────────────────────────────────────────
export function YsqResultView({
  scores,
  resultView,
  ratings,
  history,
  inactiveExpanded,
  setInactiveExpanded,
  retakeConfirm,
  setRetakeConfirm,
  onViewSchemas,
  onClose,
  onShare,
  onRetake,
}: Props) {
  const cta = contactCta();
  const tr = useTr();
  const {
    inactiveSchemas,
    activeByDomain,
    dateLabel,
    activeCount,
    activeLabel,
    getSchemaDelta,
  } = resultView;

  return (
    <div style={{ padding: '8px 0 16px' }}>
      {/* «Как понимать» + «Поделиться» — с самого верха (правило онбординга) */}
      <YsqResultTopBar
        tr={tr}
        onShare={onShare}
        onHelpOpen={() => api.trackEvent('ysq_help_open')}
      />

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            marginBottom: 4,
          }}
        >
          {activeLabel}
        </div>
        {dateLabel && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Пройдено {dateLabel}
          </div>
        )}
      </div>

      {activeCount === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 0',
            fontSize: 14,
            color: 'var(--text-sub)',
          }}
        >
          Выраженных схем не обнаружено — отличный результат.
        </div>
      )}

      {/* Active schemas grouped by domain */}
      {activeByDomain.map((domain) => (
        <div key={domain.needId} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-sub)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {domain.label}
          </div>
          {domain.schemas.map((schema) => (
            <YsqActiveSchemaCard
              key={schema.name}
              schema={schema}
              score={scores[schema.name]}
              delta={getSchemaDelta(schema.name)}
              diaryRating={ratings?.[schema.needId]}
              onViewSchemas={onViewSchemas}
              onClose={onClose}
            />
          ))}
        </div>
      ))}

      {/* Inactive schemas — collapsed */}
      <YsqInactiveSchemas
        schemas={inactiveSchemas}
        scores={scores}
        expanded={inactiveExpanded}
        setExpanded={setInactiveExpanded}
      />

      {/* CTA — прячем целиком, если сам пользователь терапевт
          (isSelf): «Написать вам» бессмысленно. */}
      {activeCount > 0 && !cta.isSelf && <YsqTherapyCta cta={cta} />}

      {/* History timeline */}
      {history.length >= 2 && <YsqHistoryTimeline history={history} />}

      <YsqResultActions
        retakeConfirm={retakeConfirm}
        setRetakeConfirm={setRetakeConfirm}
        onClose={onClose}
        onRetake={onRetake}
      />

      <YsqDisclaimer mt={16} />
    </div>
  );
}
