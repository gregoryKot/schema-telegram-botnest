// Блок шаринга «краткая карточка + полный вариант» — один контрол на все
// упражнения (правило «одна механика — один компонент»). До выноса эта
// вёрстка была скопирована в ModeEntryShare и PhraseCheckShare: пилюля,
// подпись под ней, текстовая ссылка на второй вариант и два ShareCardSheet.
//
// Состояние живёт в хуке фичи (useModeEntryShare / usePhraseCheckShare) —
// сюда приходит уже готовым, чтобы контрол оставался без своей логики.
import type { ComponentProps } from 'react';
import { SharePill } from './SharePill';
import { ShareCardSheet } from './ShareCardSheet';

type SheetProps = Omit<ComponentProps<typeof ShareCardSheet>, 'onClose'>;

export interface ShareTwoOptionsProps {
  /** Что открыто сейчас: краткая карточка, полная или ничего */
  share: 'short' | 'full' | null;
  setShare: (v: 'short' | 'full' | null) => void;
  shortProps: SheetProps | null;
  fullProps: (SheetProps & { hint?: string }) | null;
  /** Подпись под пилюлей — зачем сохранять краткую карточку */
  shortHint: string;
  /** Текст ссылки на второй, более откровенный вариант */
  fullLabel: string;
  zIndex?: number;
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-sub)',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
} as const;

const hintStyle = {
  fontSize: 11,
  color: 'var(--text-faint)',
  lineHeight: 1.5,
  textAlign: 'left',
} as const;

export function ShareTwoOptions({
  share,
  setShare,
  shortProps,
  fullProps,
  shortHint,
  fullLabel,
  zIndex,
}: ShareTwoOptionsProps) {
  if (!shortProps && !fullProps) return null;

  return (
    <>
      {shortProps && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 8,
            }}
          >
            <SharePill compact onClick={() => setShare('short')} />
          </div>
          <div style={{ ...hintStyle, marginTop: 6 }}>{shortHint}</div>
        </>
      )}
      {fullProps && (
        <div style={{ marginTop: shortProps ? 10 : 8, textAlign: 'right' }}>
          <button onClick={() => setShare('full')} style={linkStyle}>
            {fullLabel}
          </button>
          {fullProps.hint && (
            <div style={{ ...hintStyle, marginTop: 4 }}>{fullProps.hint}</div>
          )}
        </div>
      )}
      {share === 'short' && shortProps && (
        <ShareCardSheet
          {...shortProps}
          zIndex={zIndex}
          onClose={() => setShare(null)}
        />
      )}
      {share === 'full' && fullProps && (
        <ShareCardSheet
          {...fullProps}
          zIndex={zIndex}
          onClose={() => setShare(null)}
        />
      )}
    </>
  );
}
