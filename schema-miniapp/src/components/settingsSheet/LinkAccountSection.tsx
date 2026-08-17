import { getHost } from '../../../../shared/src/host';
import { SettingsLabel } from './ui';
import { useTr } from '../../utils/addressForm';
import { useAccountLink } from '../../hooks/useAccountLink';
import { linkUrl } from '../../utils/deviceLink';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';

// Перенос данных из аккаунта, который человек уже завёл на сайте или в другом
// мессенджере. Показывается только там, где своего входа для сайтов нет и без
// этого пути данные останутся разъехавшимися, — то есть в MAX.
export function LinkAccountSection() {
  const tr = useTr();
  const link = useAccountLink();
  // Буфер недоступен — код и так на экране (below), failed намеренно не
  // рендерим отдельной строкой.
  const { copied, copy } = useCopyToClipboard();
  if (getHost().id !== 'max') return null;

  const copyCode = async () => {
    if (!link.start) return;
    await copy(link.start.userCode);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ДАННЫЕ С САЙТА И ИЗ TELEGRAM</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: 14 }}>
        {link.state === 'idle' && (
          <>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-sub)',
              }}
            >
              {tr(
                'Если ты уже пользуешься приложением на сайте или в Telegram — перенеси всё сюда. Записи, оценки и упражнения окажутся в одном аккаунте.',
                'Если вы уже пользуетесь приложением на сайте или в Telegram — перенесите всё сюда. Записи, оценки и упражнения окажутся в одном аккаунте.',
              )}
            </div>
            <button
              onClick={() => void link.begin()}
              style={btnStyle}
              disabled={link.busy}
            >
              🔗 У меня уже есть аккаунт
            </button>
          </>
        )}

        {link.state === 'waiting' && link.start && (
          <>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-sub)',
              }}
            >
              {tr(
                'Открылся браузер — войди там тем способом, которым обычно заходишь. Код ниже нужен, только если браузер не открылся.',
                'Открылся браузер — войдите там тем способом, которым обычно заходите. Код ниже нужен, только если браузер не открылся.',
              )}
            </div>
            <button onClick={() => void copyCode()} style={codeStyle}>
              {link.start.userCode}
            </button>
            <div style={hintStyle}>
              {copied
                ? 'Код скопирован'
                : tr(
                    'Нажми на код, чтобы скопировать',
                    'Нажмите на код, чтобы скопировать',
                  )}
            </div>
            <div style={hintStyle}>
              {tr('Открой вручную: ', 'Откройте вручную: ')}
              {linkUrl(link.start.userCode)}
            </div>
          </>
        )}

        {link.state === 'linked' && (
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            ✅{' '}
            {tr(
              'Готово. Данные из другого аккаунта теперь здесь.',
              'Готово. Данные из другого аккаунта теперь здесь.',
            )}
          </div>
        )}

        {link.state === 'failed' && (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              {tr(
                'Код не подтвердили вовремя. Попробуй ещё раз.',
                'Код не подтвердили вовремя. Попробуйте ещё раз.',
              )}
            </div>
            <button onClick={() => void link.begin()} style={btnStyle}>
              Начать заново
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  marginTop: 12,
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  border: 'none',
  background: 'var(--text)',
  color: 'var(--bg)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const codeStyle = {
  marginTop: 12,
  width: '100%',
  minHeight: 52,
  borderRadius: 12,
  border: '1px dashed rgba(var(--fg-rgb),0.25)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '0.18em',
  cursor: 'pointer',
} as const;

const hintStyle = {
  marginTop: 8,
  fontSize: 12,
  color: 'var(--text-faint)',
  lineHeight: 1.6,
  wordBreak: 'break-all',
} as const;
