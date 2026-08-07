import { GearIcon } from '../../components/GearIcon';
import { CustomizeButton } from '../../components/plusMenu/CustomizeButton';

// Правый блок шапки профиля: «Настроить» (скрываемые блоки экрана, generic-
// хук useScreenBlocks) + шестерёнка общих настроек приложения. Вынесено из
// ProfileHeader — файл в бейслайне ratchet (правило №10 CLAUDE.md), новой
// кнопке было некуда поместиться без выноса.
export function ProfileHeaderActions({
  onOpenSettings,
  onCustomize,
}: {
  onOpenSettings: () => void;
  onCustomize: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CustomizeButton
        label="Настроить"
        ariaLabel="Настроить экран профиля"
        onClick={onCustomize}
      />
      <button
        onClick={onOpenSettings}
        aria-label="Настройки"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GearIcon />
      </button>
    </div>
  );
}
