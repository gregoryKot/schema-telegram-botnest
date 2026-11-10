// Неблокирующая карточка поддержки — показывается в дневниковых формах, когда
// клиентская детекция (crisisMarkers) находит кризисные маркеры в тексте.
// Ничего не отправляет и не блокирует сохранение — только предлагает помощь.
// Единственная копия (правило №3): фронтенды дают тонкую обёртку, прокидывая
// свой tr (ты/вы), track (аналитика) и знак (art). Показ/нажатие — useCrisisCardTracking.
// Вид (редизайн 2026-11, docs/design/APP_2026-11.md, b12): бережная бумага розы (--h 25,
// .pp-paper) без контура, знак Heart у заголовка Literata; номера — кнопки tel: на всю ширину:
// взрослая линия — белая плашка с тенью сплошным слоем (≥56px), детская — второй строкой тише.
// Стили инлайном (crisisCardStyle.ts): карточку берут и кабинет, и визитка (BookingCrisisNote), CSS
// экрана туда не доезжает. flat — та же карточка без своей бумаги: на листе экрана, который уже бережный.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { CRISIS_HOTLINES } from '../utils/crisisMarkers';
import { useCrisisCardTracking } from '../analytics/useCrisisCardTracking';
import { crisisCardCopy } from './crisisCardCopy';
import { CRISIS_CARD_STYLE as S, CRISIS_HUE } from './crisisCardStyle';

type Tr = (ty: string, vy: string) => string;
type Track = (name: string, meta?: Record<string, unknown>) => void;

export function CrisisCardView({
  surface,
  standing,
  compact,
  scrollIntoView,
  flat,
  art,
  label,
  children,
  tr,
  track,
}: {
  /** экран, где показалась карточка (без текста пользователя, правило №7) */
  surface?: string;
  standing?: boolean; // постоянный блок, а не показ по детекции — crisisCardCopy
  /** Только заголовок и телефоны: для низкого экрана, где всё важное должно влезть сразу. */
  compact?: boolean;
  /** Карточка, появившаяся под клавиатурой, прокручивается в видимую область (C-З7). По умолчанию — у показа по детекции, не у постоянного блока. */
  scrollIntoView?: boolean;
  /** Без своей бумаги и полей — карточка лежит на бережном листе экрана. */
  flat?: boolean;
  /** Знак у заголовка (сайт ставит Heart); декор — скрыт от чтения с экрана. */
  art?: ReactNode;
  /** Надпись над заголовком (постоянный блок «Помощь рядом»). */
  label?: ReactNode;
  /** Продолжение карточки на той же бумаге (112, разговор с близким). */
  children?: ReactNode;
  tr: Tr;
  track: Track;
}) {
  const onHotlineTap = useCrisisCardTracking(surface, track);
  const copy = crisisCardCopy(standing, tr);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollIntoView ?? !standing) revealAboveKeyboard(ref.current);
  }, [scrollIntoView, standing]);
  const box: CSSProperties = flat
    ? { margin: 0 }
    : ({
        '--h': CRISIS_HUE,
        padding: '18px 18px 20px',
        margin: compact ? 0 : '12px 0',
      } as CSSProperties);
  return (
    <div
      ref={ref}
      role="status"
      className={flat ? undefined : 'pp-paper'}
      data-crisis-card=""
      style={box}
    >
      <div style={S.head}>
        {art && (
          <span aria-hidden="true" style={S.art}>
            {art}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          {label && (
            <span className="ds-label" style={S.label}>
              {label}
            </span>
          )}
          <p style={S.title}>{copy.title}</p>
        </div>
      </div>
      {!compact && <p style={S.lead}>{copy.lead}</p>}
      <div style={S.lines}>
        {CRISIS_HOTLINES.map((hotline, i) => (
          <a
            key={hotline.tel}
            href={hotline.tel}
            onClick={onHotlineTap}
            aria-label={`Позвонить на телефон доверия ${hotline.display}`}
            // Номер — текстом самой ссылки (getByText находит ссылку), подпись аудитории — рядом.
            style={{ ...S.line, ...(i === 0 ? S.main : S.sub) }}
          >
            {hotline.display}
            {hotline.audienceNote && (
              <span style={S.note}>{hotline.audienceNote}</span>
            )}
          </a>
        ))}
      </div>
      {!compact && <p style={S.foot}>{copy.foot}</p>}
      {children}
    </div>
  );
}

/**
 * Нижняя кромка карточки должна оказаться выше экранной клавиатуры: берём
 * visualViewport (он сжимается клавиатурой), а без него — innerHeight.
 */
export function revealAboveKeyboard(el: HTMLElement | null): void {
  if (!el || typeof window === 'undefined') return;
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const rect = el.getBoundingClientRect();
  if (rect.bottom <= visibleBottom && rect.top >= 0) return;
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}
