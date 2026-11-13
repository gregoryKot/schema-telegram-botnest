// Детальный просмотр записи «Моего пути»: тап по шагу → открыть и прочитать ВСЁ, что сохранено (без
// обрезки, все поля), с одной залитой «Поделиться карточкой». Шапку (лист бумаги сущности со знаком,
// EntitySheet) и голос Здорового Взрослого (HealthyVoice) даёт площадка — shared не импортирует webapp;
// без них — заголовок и спокойная подпись поля. Поля — подпись ds-label и текст, без цветных полос.
// На ≥1024 шапка слева липнет, поля справа (pa-spread). Классы — webapp/src/styles/journey.css.
import { useCallback, useState, type ReactNode } from 'react';
import {
  type JourneyItem,
  formatJourneyDay,
  journeyTypeMeta,
} from './journeyMeta';
import type { JourneyResultPart } from './journeyContent';
import { glueSpaces } from '../utils/typo';

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

export interface JourneyDetailArt {
  /** Шапка шага: label — название типа, line — дата и уточнение. */
  head?: (item: JourneyItem, label: string, line: string) => ReactNode;
  /** Поле-голос Здорового Взрослого («Здоровый взгляд», «Здоровый Взрослый»). */
  voice?: (title: string, text: string) => ReactNode;
}

export function JourneyItemDetail({
  detail,
  subtitle,
  onShare,
  deleteButton,
  art = {},
}: {
  detail: JourneyDetailState;
  subtitle: (item: JourneyItem) => string | null;
  onShare: () => void;
  deleteButton?: ReactNode;
  art?: JourneyDetailArt;
}) {
  const { item, parts, loading, close: onBack } = detail;
  if (!item) return null;
  const { label } = journeyTypeMeta(item.type);
  const sub = subtitle(item);
  const line = formatJourneyDay(item.at) + (sub ? ` · ${sub}` : '');

  return (
    <div className="jr-detail">
      <button type="button" className="ds-back jr-back" onClick={onBack}>
        ← Назад
      </button>
      <div className="pa-spread jr-spread">
        <div className="pa-spread-side">
          {art.head?.(item, label, line) ?? (
            <div className="jr-detail-head">
              <h2 className="jr-detail-title">{label}</h2>
              <p className="jr-detail-line">{line}</p>
            </div>
          )}
        </div>
        <div className="pa-spread-main">
          {loading ? (
            <div className="jr-detail-skel" aria-hidden="true">
              {[92, 70, 84].map((w) => (
                <span key={w} style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : parts.length === 0 ? (
            <p className="jr-note">
              Здесь без записанного текста — только сам факт этого шага.
            </p>
          ) : (
            <div className="jr-fields">
              {parts.map((p, i) =>
                p.title && art.voice && p.healthy ? (
                  <div key={i}>{art.voice(p.title, p.text)}</div>
                ) : (
                  <div key={i} className="jr-field">
                    {p.title && (
                      <div className="ds-label jr-field-label">{p.title}</div>
                    )}
                    <div className="jr-field-text">{glueSpaces(p.text)}</div>
                  </div>
                ),
              )}
            </div>
          )}
          <div className="jr-detail-actions">
            <button
              type="button"
              className="ds-btn ds-btn--lg jr-share"
              onClick={onShare}
            >
              Поделиться карточкой
            </button>
            {deleteButton}
          </div>
        </div>
      </div>
    </div>
  );
}
