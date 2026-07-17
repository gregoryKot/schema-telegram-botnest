import { api } from '../../api';
import { botShortUrl } from '../../utils/botConfig';
import { Row, SettingsLabel } from './primitives';

export function ShareExportSection({
  setExportText,
}: {
  setExportText: (text: string) => void;
}) {
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
                /* игнорируем */
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
              /* игнорируем */
            }
            if (!shared) {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* игнорируем */
              }
              setExportText(text);
            }
          }}
        />
      </div>
    </div>
  );
}
