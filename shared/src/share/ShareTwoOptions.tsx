// Блок шаринга «краткая карточка + полный вариант» — ОДИН на оба фронтенда
// (правило №3; лист и кнопка приходят инъекцией). Один контрол на все
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
import type { ComponentType } from 'react';
import type { ShareCardSheetProps } from './shareCardSheetProps';

type SheetProps = Omit<ShareCardSheetProps, 'onClose'>;

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
  /** Лист шаринга площадки (вёрстка у фронтендов своя, правило №3). */
  Sheet: ComponentType<ShareCardSheetProps>;
  /** Кнопка площадки: подпись + клик. */
  Pill: ComponentType<{ label: string; onClick: () => void }>;
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
  Sheet,
  Pill,
}: ShareTwoOptionsProps) {
  if (!shortProps && !fullProps) return null;

  return (
    <>
      {shortProps && (
        <div className="u-mt8">
          <Pill
            label={shortLabel ?? 'Поделиться карточкой'}
            onClick={() => setShare('short')}
          />
          <div style={{ ...hintStyle, marginTop: 6 }}>{shortHint}</div>
        </div>
      )}
      {fullProps && (
        <div style={{ marginTop: shortProps ? 12 : 8 }}>
          <Pill label={fullLabel} onClick={() => setShare('full')} />
          {fullProps.hint && (
            <div style={{ ...hintStyle, marginTop: 6 }}>{fullProps.hint}</div>
          )}
        </div>
      )}
      {share === 'short' && shortProps && (
        <Sheet {...shortProps} zIndex={zIndex} onClose={() => setShare(null)} />
      )}
      {share === 'full' && fullProps && (
        <Sheet {...fullProps} zIndex={zIndex} onClose={() => setShare(null)} />
      )}
    </>
  );
}
