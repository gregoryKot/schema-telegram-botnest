// Детальный просмотр записи «Моего пути»: тап по шагу → открыть и прочитать
// ВСЁ, что сохранено (без обрезки, все поля), с кнопкой поделиться внутри.
// Единственная копия для обоих фронтендов (правило №3). Обёртка — per-frontend.
import { useCallback, useState } from 'react';
import {
  type JourneyItem,
  JOURNEY_GROUP_COLORS,
  formatJourneyDay,
  journeyTypeMeta,
} from './journeyMeta';
import type { JourneyResultPart } from './journeyContent';

export interface JourneyDetailState {
  item: JourneyItem | null;
  parts: JourneyResultPart[];
  loading: boolean;
  open: (item: JourneyItem) => void;
  close: () => void;
}

/** Открытие записи: тянет полные части по тапу (расшифровка на клиенте). */
export function useJourneyDetail(
  fetchDetail: (item: JourneyItem) => Promise<JourneyResultPart[]>,
): JourneyDetailState {
  const [item, setItem] = useState<JourneyItem | null>(null);
  const [parts, setParts] = useState<JourneyResultPart[]>([]);
  const [loading, setLoading] = useState(false);

  const open = useCallback(
    (it: JourneyItem) => {
      setItem(it);
      setParts([]);
      setLoading(true);
      void fetchDetail(it)
        .catch(() => [] as JourneyResultPart[])
        .then((p) => {
          setParts(p);
          setLoading(false);
        });
    },
    [fetchDetail],
  );
  const close = useCallback(() => {
    setItem(null);
    setParts([]);
    setLoading(false);
  }, []);

  return { item, parts, loading, open, close };
}

export function JourneyItemDetail({
  detail,
  subtitle,
  onShare,
}: {
  detail: JourneyDetailState;
  subtitle: (item: JourneyItem) => string | null;
  onShare: () => void;
}) {
  const { item, parts, loading, close: onBack } = detail;
  if (!item) return null;
  const meta = journeyTypeMeta(item.type);
  const hex = JOURNEY_GROUP_COLORS[meta.group].hex;
  const sub = subtitle(item);

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-sub)',
          fontSize: 14,
          fontFamily: 'inherit',
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 10,
        }}
      >
        ← Назад
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 38, lineHeight: 1 }}>{meta.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-sub)' }}>
            {formatJourneyDay(item.at)}
            {sub ? ` · ${sub}` : ''}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[92, 70, 84].map((w, i) => (
            <div
              key={i}
              style={{
                height: 14,
                width: `${w}%`,
                borderRadius: 6,
                background: 'rgba(var(--fg-rgb),0.08)',
              }}
            />
          ))}
        </div>
      ) : parts.length === 0 ? (
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--text-faint)',
            lineHeight: 1.6,
          }}
        >
          Здесь без записанного текста — только сам факт этого шага.
        </div>
      ) : (
        parts.map((p, i) => (
          <div
            key={i}
            style={{
              borderLeft: `2px solid ${hex}`,
              paddingLeft: 12,
              marginBottom: 16,
            }}
          >
            {p.title && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: hex,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 5,
                }}
              >
                {p.title}
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                color: 'var(--text)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {p.text}
            </div>
          </div>
        ))
      )}

      <button
        onClick={onShare}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '13px 0',
          borderRadius: 14,
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          background: `color-mix(in srgb, ${hex} 20%, transparent)`,
          color: hex,
        }}
      >
        Поделиться карточкой
      </button>
    </div>
  );
}
