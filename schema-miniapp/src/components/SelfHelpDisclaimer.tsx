// Дисклеймер о границах самопомощи (экран «Здесь и сейчас»).
// Клиническая честность рядом с практиками: регуляция — передышка, не лечение;
// при постоянном «глушении» чувств закрепляется избегающее поведение
// (experiential avoidance). Тон — тёплый и ясный, без запугивания.
// Вход — кнопка-значок ⚠️ в шапке «Здесь и сейчас» (HelpHeader.tsx; была
// широким текстовым чипом, сужена до значка), полный текст — по тапу.
import { BottomSheet } from './BottomSheet';
import { useTr } from '../utils/addressForm';

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
          className="d-display"
          style={{
            fontSize: 21,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          Важное о самопомощи
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
            'Ориентир простой: практика нужна, чтобы вернуться к жизни и к чувствам — а не спрятаться от них. Если замечаешь, что тянешься к ним всё чаще, — провала тут нет. Это сигнал, что пора поговорить со специалистом.',
            'Ориентир простой: практика нужна, чтобы вернуться к жизни и к чувствам — а не спрятаться от них. Если замечаете, что тянетесь к ним всё чаще, — провала тут нет. Это сигнал, что пора поговорить со специалистом.',
          )}
        </P>
        <P>
          Самопомощь не заменяет терапию. Если тяжело подолгу и часто — не
          обязательно нести это в одиночку.
        </P>
        <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 4 }}>
          {onOpenCrisis && (
            <button
              onClick={onOpenCrisis}
              style={{
                padding: '13px 16px',
                borderRadius: 'var(--r-12)',
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
