// Неблокирующая карточка поддержки — показывается в дневниковых формах, когда
// клиентская детекция (crisisMarkers) находит кризисные маркеры в тексте.
// Ничего не отправляет и не блокирует сохранение — только предлагает помощь.
// Единственная копия (правило №3): фронтенды дают тонкую обёртку, прокидывая
// свой tr (ты/вы) и track (аналитика). Показ/нажатие — useCrisisCardTracking.
import { CRISIS_HOTLINES } from '../utils/crisisMarkers';
import { useCrisisCardTracking } from '../analytics/useCrisisCardTracking';

type Tr = (ty: string, vy: string) => string;
type Track = (name: string, meta?: Record<string, unknown>) => void;

export function CrisisCardView({
  surface,
  tr,
  track,
}: {
  /** экран, где показалась карточка (без текста пользователя, правило №7) */
  surface?: string;
  tr: Tr;
  track: Track;
}) {
  const onHotlineTap = useCrisisCardTracking(surface, track);
  return (
    <div
      role="status"
      style={{
        background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        borderRadius: 14,
        padding: '14px 16px',
        margin: '12px 0',
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
        💛 Похоже, сейчас очень тяжело
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10 }}>
        {tr(
          'С этим не нужно справляться в одиночку. Если тяжело прямо сейчас — позвони на бесплатный телефон доверия:',
          'Вы не обязаны справляться с этим в одиночку. Если тяжело прямо сейчас — позвоните на бесплатный телефон доверия:',
        )}
      </div>
      {CRISIS_HOTLINES.map((hotline) => (
        <div key={hotline.tel} style={{ marginBottom: 4 }}>
          <a
            href={hotline.tel}
            onClick={onHotlineTap}
            aria-label={`Позвонить на телефон доверия ${hotline.display}`}
            style={{
              display: 'inline-block',
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
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
        Круглосуточно, бесплатно, анонимно. Запись сохранится как обычно — эта
        карточка ничего никуда не отправляет.
      </div>
    </div>
  );
}
