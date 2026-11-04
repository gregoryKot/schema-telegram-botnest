// Неблокирующая карточка поддержки — показывается в дневниковых формах, когда
// клиентская детекция (crisisMarkers) находит кризисные маркеры в тексте.
// Ничего не отправляет и не блокирует сохранение — только предлагает помощь.
// Единственная копия (правило №3): фронтенды дают тонкую обёртку, прокидывая
// свой tr (ты/вы) и track (аналитика). Показ/нажатие — useCrisisCardTracking.
import { useEffect, useRef } from 'react';
import { CRISIS_HOTLINES } from '../utils/crisisMarkers';
import { useCrisisCardTracking } from '../analytics/useCrisisCardTracking';
import { crisisCardCopy } from './crisisCardCopy';

type Tr = (ty: string, vy: string) => string;
type Track = (name: string, meta?: Record<string, unknown>) => void;

export function CrisisCardView({
  surface,
  standing,
  compact,
  scrollIntoView,
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
  tr: Tr;
  track: Track;
}) {
  const onHotlineTap = useCrisisCardTracking(surface, track);
  const copy = crisisCardCopy(standing, tr);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollIntoView ?? !standing) revealAboveKeyboard(ref.current);
  }, [scrollIntoView, standing]);
  return (
    <div
      ref={ref}
      role="status"
      style={{
        background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        borderRadius: 14,
        padding: '14px 16px',
        margin: compact ? 0 : '12px 0',
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 6,
        }}
      >
        {copy.title}
      </div>
      {!compact && (
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10 }}>
          {copy.lead}
        </div>
      )}
      {CRISIS_HOTLINES.map((hotline) => (
        <div key={hotline.tel} className="u-mb4">
          <a
            href={hotline.tel}
            onClick={onHotlineTap}
            aria-label={`Позвонить на телефон доверия ${hotline.display}`}
            style={{
              // Зона нажатия ≥ 44 по высоте: телефон доверия — самая важная
              // цель нажатия в продукте (в палец не промахнуться в кризисе).
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '12px 0',
              fontSize: hotline.audienceNote ? 14 : 17,
              fontWeight: 700,
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            {hotline.display}
          </a>
          {hotline.audienceNote && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                marginLeft: 6,
              }}
            >
              {hotline.audienceNote}
            </span>
          )}
        </div>
      ))}
      {!compact && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
          {copy.foot}
        </div>
      )}
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
