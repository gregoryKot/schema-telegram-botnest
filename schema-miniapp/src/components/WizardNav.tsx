interface Props {
  accentColor: string;
  onBack: () => void;
  backDisabled: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryKind: 'next' | 'save';
  gradientSave?: boolean;
}

// Ряд кнопок навигации визарда (← Назад / Далее|Сохранить) — общий примитив
// для IntroSheetShell и ModeDiaryWizard (правило «одна механика — один
// компонент», CLAUDE.md).
//
// Прозрачность берём через color-mix, а не склейкой `${accentColor}20`:
// accentColor приходит и как hex, и как var(--accent) — во втором случае
// склейка даёт невалидный цвет, и кнопка молча становится прозрачной.
export function WizardNav({
  accentColor,
  onBack,
  backDisabled,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryKind,
  gradientSave,
}: Props) {
  const primaryBg = primaryDisabled
    ? 'var(--surface-2)'
    : primaryKind === 'save'
      ? gradientSave
        ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 80%, transparent), color-mix(in srgb, ${accentColor} 53%, transparent))`
        : accentColor
      : `color-mix(in srgb, ${accentColor} 12%, transparent)`;
  const primaryColor = primaryDisabled
    ? 'var(--text-faint)'
    : primaryKind === 'save'
      ? '#fff'
      : accentColor;

  return (
    <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
      <button
        onClick={onBack}
        disabled={backDisabled}
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-12)',
          border: 'none',
          fontFamily: 'inherit',
          background: backDisabled ? 'var(--surface)' : 'var(--surface-2)',
          color: backDisabled ? 'var(--text-faint)' : 'var(--text-sub)',
          fontSize: 18,
          cursor: backDisabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ←
      </button>
      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        style={{
          flex: 1,
          padding: '13px',
          borderRadius: 'var(--r-12)',
          border: 'none',
          fontFamily: 'inherit',
          background: primaryBg,
          color: primaryColor,
          fontSize: 14,
          fontWeight: 600,
          cursor: primaryDisabled ? 'default' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}
