// Дисклеймер о границах самопомощи (экран «Здесь и сейчас»).
// Клиническая честность рядом с практиками: регуляция — передышка, не лечение;
// при постоянном «глушении» чувств закрепляется избегающее поведение
// (experiential avoidance). Тон — тёплый и ясный, без запугивания.
// Вход — кнопка-значок ⚠️ в шапке «Здесь и сейчас» (HelpHeader.tsx; была
// широким текстовым чипом, сужена до значка), полный текст — по тапу.
// Сам текст – в shared/src/selfHelp/selfHelpText.ts (общий с сайтом).
import { BottomSheet } from './BottomSheet';
import { useTr } from '../utils/addressForm';
import {
  buildSelfHelpParagraphs,
  SELF_HELP_TITLE,
} from '../../../shared/src/selfHelp/selfHelpText';

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
      <div className="u-pt4">
        <div
          className="d-display"
          style={{
            fontSize: 21,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          {SELF_HELP_TITLE}
        </div>
        {buildSelfHelpParagraphs(tr).map((p) => (
          <P key={p}>{p}</P>
        ))}
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
          <button className="btn-primary u-flex1" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
