import { useTr } from '../../utils/addressForm';
import { NeedFillRow } from './NeedFillRow';
import {
  NEED_IDS,
  type NeedId,
  type NeedMetaEntry,
  type Ratings,
} from './types';

export function FillPhase({
  NEED_META,
  ratings,
  setRatings,
  openExampleId,
  setOpenExampleId,
  openExampleIdx,
  setOpenExampleIdx,
  saving,
  onSave,
}: {
  NEED_META: Record<NeedId, NeedMetaEntry>;
  ratings: Ratings;
  setRatings: React.Dispatch<React.SetStateAction<Ratings>>;
  openExampleId: NeedId | null;
  setOpenExampleId: React.Dispatch<React.SetStateAction<NeedId | null>>;
  openExampleIdx: number | null;
  setOpenExampleIdx: React.Dispatch<React.SetStateAction<number | null>>;
  saving: boolean;
  onSave: () => void;
}) {
  const tr = useTr();
  return (
    <div>
      {/* Idealization warning */}
      <div
        style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent-yellow)',
            marginBottom: 4,
          }}
        >
          ⚠️ Осторожно: защитная идеализация
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.65,
          }}
        >
          Психика защищает нас от боли — поэтому мы склонны помнить хорошее и не
          замечать систематические паттерны.
          {tr('Оценивай', 'Оценивайте')} <em>не отдельные моменты</em>, а то{' '}
          <em>как было в целом, большую часть времени</em>. Под каждым ползунком
          — описания крайностей, а по кнопке{' '}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'rgba(var(--fg-rgb),0.12)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-sub)',
              verticalAlign: 'middle',
            }}
          >
            ?
          </span>{' '}
          — реальные примеры из жизни.{' '}
          {tr('Сравни с ними.', 'Сравните с ними.')}
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        0 — совсем нет, 10 — в полной мере
      </div>

      {NEED_IDS.map((id) => (
        <NeedFillRow
          key={id}
          id={id}
          meta={NEED_META[id]}
          value={ratings[id]}
          onChange={(v) => setRatings((prev) => ({ ...prev, [id]: v }))}
          openExampleId={openExampleId}
          setOpenExampleId={setOpenExampleId}
          openExampleIdx={openExampleIdx}
          setOpenExampleIdx={setOpenExampleIdx}
        />
      ))}

      <button
        onClick={onSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '15px 0',
          borderRadius: 14,
          border: 'none',
          background: saving
            ? 'rgba(var(--fg-rgb),0.1)'
            : 'linear-gradient(135deg, #a78bfa, #4fa3f7)',
          color: 'var(--text)',
          fontSize: 16,
          fontWeight: 600,
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? '...' : 'Посмотреть результат'}
      </button>
    </div>
  );
}
