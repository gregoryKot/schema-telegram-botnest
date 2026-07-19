import { api } from '../../api';
import { botShortUrl } from '../../utils/botConfig';
import { Row, SettingsLabel } from './ui';

interface NameProps {
  editName: string;
  setEditName: (v: string) => void;
  displayName?: string | null;
  tgName: string;
  nameSaving: boolean;
  setNameSaving: (v: boolean) => void;
  onNameChanged?: (name: string) => void;
  setSavedToast: (v: boolean) => void;
}

export function NameSection({
  editName,
  setEditName,
  displayName,
  tgName,
  nameSaving,
  setNameSaving,
  onNameChanged,
  setSavedToast,
}: NameProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>КАК ТЕБЯ ЗОВУТ</SettingsLabel>
      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Твоё имя"
          maxLength={50}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        {editName !== (displayName ?? tgName) && (
          <button
            disabled={nameSaving || !editName.trim()}
            onClick={async () => {
              const name = editName.trim();
              if (!name) return;
              setNameSaving(true);
              try {
                await api.updateName(name);
                onNameChanged?.(name);
                setSavedToast(true);
                setTimeout(() => setSavedToast(false), 1800);
              } catch {
                /* best-effort: ошибку намеренно игнорируем */
              } finally {
                setNameSaving(false);
              }
            }}
            style={{
              background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              border: 'none',
              borderRadius: 10,
              padding: '6px 14px',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {nameSaving ? '...' : 'Сохранить'}
          </button>
        )}
      </div>
      {tgName && editName !== tgName && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            marginTop: 4,
            padding: '0 4px',
          }}
        >
          В Telegram: {tgName}
        </div>
      )}
    </div>
  );
}

interface ShareProps {
  setExportText: (v: string | null) => void;
}

export function ShareSection({ setExportText }: ShareProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ПОДЕЛИТЬСЯ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Row
          label="Пригласить друга"
          sub="Поделиться ссылкой на бота"
          emoji="🔗"
          onClick={async () => {
            const text = `Трекер потребностей — отслеживай своё состояние каждый день. ${botShortUrl}`;
            try {
              if (navigator.share) await navigator.share({ text });
              else await navigator.clipboard.writeText(text);
            } catch {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* best-effort: ошибку намеренно игнорируем */
              }
            }
          }}
        />
        <Row
          label="Для терапевта"
          sub="Сводка за 30 дней"
          emoji="📤"
          divider
          onClick={async () => {
            const { text } = await api.getExport();
            let shared = false;
            try {
              if (navigator.share) {
                await navigator.share({ text });
                shared = true;
              }
            } catch {
              /* best-effort: ошибку намеренно игнорируем */
            }
            if (!shared) {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* best-effort: ошибку намеренно игнорируем */
              }
              setExportText(text);
            }
          }}
        />
      </div>
    </div>
  );
}

interface DataProps {
  onPrivacy: () => void;
  onDelete: () => void;
}

export function DataSection({ onPrivacy, onDelete }: DataProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ДАННЫЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Row
          label="О данных и конфиденциальности"
          emoji="🔒"
          onClick={onPrivacy}
        />
        <Row
          label="Удалить все данные"
          emoji="🗑"
          divider
          color="#f87171"
          onClick={onDelete}
        />
      </div>
    </div>
  );
}
