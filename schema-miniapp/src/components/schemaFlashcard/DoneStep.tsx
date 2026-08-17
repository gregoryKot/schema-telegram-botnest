import { BottomSheet } from '../BottomSheet';
import { SaveErrorNote } from '../SaveErrorNote';
import { DoneSummaryCard } from './DoneSummaryCard';
import { NEEDS } from './constants';
import type { ModeData } from './types';

interface DoneStepProps {
  modes: ModeData[];
  selectedMode: string | null;
  selectedNeed: string | null;
  action: string;
  tr: (ty: string, vy: string) => string;
  onClose: () => void;
  onOpenTracker?: () => void;
  onNew: () => void;
  saveError?: boolean;
}

export function DoneStep({
  modes,
  selectedMode,
  selectedNeed,
  action,
  tr,
  onClose,
  onOpenTracker,
  onNew,
  saveError,
}: DoneStepProps) {
  const modeInfo = modes.find((m) => m.id === selectedMode);
  const needInfo = NEEDS.find((n) => n.id === selectedNeed);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              background: 'var(--calm)',
              margin: '0 auto 14px',
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            Сохранено
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            {tr(
              'Это твой шаг навстречу себе. Уже немало.',
              'Это ваш шаг навстречу себе. Уже немало.',
            )}
          </div>
        </div>
        <DoneSummaryCard
          modeLabel={modeInfo?.label ?? ''}
          needLabel={needInfo?.label}
          action={action}
        />
        {saveError && (
          <SaveErrorNote
            ty="Не удалось сохранить на сервере — карточка осталась на этом устройстве."
            vy="Не удалось сохранить на сервере — карточка осталась на этом устройстве."
          />
        )}
        {onOpenTracker && (
          <button
            onClick={() => {
              onClose();
              setTimeout(onOpenTracker, 100);
            }}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface)',
              outline: '1px solid var(--border-color)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Открыть трекер →
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onNew}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface-2)',
              color: 'var(--text-sub)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ещё одну
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
