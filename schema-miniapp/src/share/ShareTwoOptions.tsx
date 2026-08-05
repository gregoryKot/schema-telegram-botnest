// Блок шаринга «краткая карточка + полный вариант» — один контрол на все
// упражнения (правило «одна механика — один компонент»). До выноса эта
// вёрстка была скопирована в ModeEntryShare и PhraseCheckShare.
//
// Оба варианта — ОДИНАКОВЫЕ кнопки с подписью. Раньше первый был безымянным
// значком, а второй — подчёркнутой ссылкой: два соседних действия одного
// смысла выглядели как разные виды элементов, и по значку нельзя было понять,
// чем он делится, а чем вторая строка (замечание пользователя, 2026-08).
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
  /** Подпись первой кнопки; по умолчанию — «Поделиться карточкой» */
  shortLabel?: string;
  /** Подпись второй кнопки — более откровенный вариант */
  fullLabel: string;
  zIndex?: number;
}

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
  shortLabel,
  fullLabel,
  zIndex,
}: ShareTwoOptionsProps) {
  if (!shortProps && !fullProps) return null;

  return (
    <>
      {shortProps && (
        <div style={{ marginTop: 8 }}>
          <SharePill
            label={shortLabel ?? 'Поделиться карточкой'}
            onClick={() => setShare('short')}
          />
          <div style={{ ...hintStyle, marginTop: 6 }}>{shortHint}</div>
        </div>
      )}
      {fullProps && (
        <div style={{ marginTop: shortProps ? 12 : 8 }}>
          <SharePill label={fullLabel} onClick={() => setShare('full')} />
          {fullProps.hint && (
            <div style={{ ...hintStyle, marginTop: 6 }}>{fullProps.hint}</div>
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
