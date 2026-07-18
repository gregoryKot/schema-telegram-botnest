// Дисклеймер о границах самопомощи (экран «Здесь и сейчас»).
// Клиническая честность рядом с практиками: регуляция — передышка, не лечение;
// при постоянном «глушении» чувств закрепляется избегающее поведение
// (experiential avoidance). Тон — тёплый и ясный, без запугивания.
// Баннер — заметный (⚠️), полный текст — по тапу (прогрессивное раскрытие).
import { BottomSheet } from './BottomSheet';
import { useTr } from '../utils/addressForm';

export function SelfHelpBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '13px 16px',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        background: 'color-mix(in srgb, var(--accent-yellow) 9%, transparent)',
        border:
          '1px solid color-mix(in srgb, var(--accent-yellow) 28%, transparent)',
        animation: 'slide-up 0.3s ease both',
        animationDelay: '60ms',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>⚠️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          Практики — передышка, не лечение
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 1,
          }}
        >
          важное о границах самопомощи
        </span>
      </span>
      <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>
        ›
      </span>
    </button>
  );
}

export function SelfHelpSheet({
  onClose,
  onOpenCrisis,
}: {
  onClose: () => void;
  onOpenCrisis?: () => void;
}) {
  const tr = useTr();
  const P = ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        fontSize: 14,
        color: 'var(--text-sub)',
        lineHeight: 1.65,
        margin: '0 0 12px',
      }}
    >
      {children}
    </p>
  );
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          ⚠️ Важное о самопомощи
        </div>
        <P>
          Дыхание, заземление и другие практики здесь — способ пережить острый
          момент. Они как спасательный жилет в шторм: помогают удержаться на
          воде, но не меняют погоду.
        </P>
        <P>
          У самопомощи есть и обратная сторона. Если каждый раз глушить чувства
          практикой, можно незаметно научиться их избегать — а то, чего мы
          избегаем, со временем пугает сильнее. Так закрепляется избегающее
          поведение.
        </P>
        <P>
          {tr(
            'Ориентир простой: практика нужна, чтобы вернуться к жизни и к чувствам — а не спрятаться от них. Если замечаешь, что тянешься к ним всё чаще, — это не провал. Это сигнал, что пора поговорить со специалистом.',
            'Ориентир простой: практика нужна, чтобы вернуться к жизни и к чувствам — а не спрятаться от них. Если замечаете, что тянетесь к ним всё чаще, — это не провал. Это сигнал, что пора поговорить со специалистом.',
          )}
        </P>
        <P>
          Самопомощь не заменяет терапию. Если тяжело подолгу и часто — не
          обязательно нести это в одиночку.
        </P>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {onOpenCrisis && (
            <button
              onClick={onOpenCrisis}
              style={{
                padding: '13px 16px',
                borderRadius: 12,
                border: 'none',
                background: 'rgba(var(--fg-rgb),0.06)',
                color: 'var(--text-sub)',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Контакты помощи
            </button>
          )}
          <button className="btn-primary" style={{ flex: 1 }} onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
