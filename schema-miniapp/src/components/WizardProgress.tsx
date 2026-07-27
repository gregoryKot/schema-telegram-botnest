import { pressable } from '../utils/a11y';

export interface WizardProgressSegment {
  filled: boolean;
}

interface Props {
  segments: WizardProgressSegment[];
  active: number;
  accentColor: string;
  onSelect?: (i: number) => void;
}

// Полоса сегментов прогресса визарда — общий примитив для интро-карточек
// (IntroSheetShell: ModeIntroSheet/SchemaIntroSheet) и дневниковых визардов
// (ModeDiaryWizard). Была продублирована почти дословно между ними (правило
// «одна механика — один компонент», CLAUDE.md).
export function WizardProgress({
  segments,
  active,
  accentColor,
  onSelect,
}: Props) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {segments.map((segment, i) => {
        const style = {
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: segment.filled
            ? accentColor
            : i === active
              ? `${accentColor}55`
              : 'var(--surface-2)',
          transition: 'background 0.2s',
          cursor: onSelect ? 'pointer' : undefined,
        };
        return onSelect ? (
          <div key={i} {...pressable(() => onSelect(i))} style={style} />
        ) : (
          <div key={i} style={style} />
        );
      })}
    </div>
  );
}
