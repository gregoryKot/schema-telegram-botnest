// Неблокирующая карточка поддержки — показывается в дневниковых формах, когда
// клиентская детекция (utils/crisisMarkers) находит кризисные маркеры в тексте.
// Ничего не отправляет и не блокирует сохранение — только предлагает помощь.
// ВАЖНО: файл парный (webapp ↔ schema-miniapp) — правки вносить в оба.
import { useTr } from '../utils/addressForm';
import {
  CRISIS_HOTLINE_DISPLAY,
  CRISIS_HOTLINE_TEL,
} from '../utils/crisisMarkers';

export function CrisisCard() {
  const tr = useTr();
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
          'Ты не обязан(а) справляться с этим в одиночку. Если тяжело прямо сейчас — позвони на бесплатный телефон доверия:',
          'Вы не обязаны справляться с этим в одиночку. Если тяжело прямо сейчас — позвоните на бесплатный телефон доверия:',
        )}
      </div>
      <a
        href={CRISIS_HOTLINE_TEL}
        aria-label={`Позвонить на телефон доверия ${CRISIS_HOTLINE_DISPLAY}`}
        style={{
          display: 'inline-block',
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--accent)',
          textDecoration: 'none',
          marginBottom: 6,
        }}
      >
        {CRISIS_HOTLINE_DISPLAY}
      </a>
      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
        Круглосуточно, бесплатно, анонимно. Запись сохранится как обычно — эта
        карточка ничего никуда не отправляет.
      </div>
    </div>
  );
}
