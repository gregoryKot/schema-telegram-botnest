import { BottomSheet } from './BottomSheet';

// Общий каркас листов «что показывать»: заголовок + подзаголовок + список +
// «Готово». Раньше этот каркас (шапка + btn-primary «Готово») был скопирован
// в QuickActionCustomizeSheet — второй потребитель (ScreenCustomizeSheet)
// вынес его сюда, чтобы не плодить третью копию (правило «одна механика —
// один компонент» / jscpd-храповик).
interface Props {
  title: string;
  subtitle: string;
  zIndex?: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function CustomizeSheetShell({
  title,
  subtitle,
  zIndex,
  onClose,
  children,
}: Props) {
  return (
    <BottomSheet onClose={onClose} zIndex={zIndex}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
        {children}
        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
