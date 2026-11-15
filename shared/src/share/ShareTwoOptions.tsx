// Шаринг «краткая карточка или полная» — один на все упражнения (правило №3;
// лист карточки, шторка выбора и ссылка — инъекцией площадки). Под итогом —
// одна тихая ссылка «Поделиться →», а не две кнопки у главного действия: есть
// оба варианта — шторка выбора с подписью, что на какой карточке; один — сразу
// его лист. Состояние открытого — в хуке фичи (usePhraseCheckShare).
import type { ComponentType } from 'react';
import type { ShareCardSheetProps } from './shareCardSheetProps';

type SheetProps = Omit<ShareCardSheetProps, 'onClose'>;

/** Вариант карточки. */
export type ShareVariant = 'short' | 'full';
/** Что открыто: шторка выбора, лист варианта или ничего. */
export type ShareOpen = 'pick' | ShareVariant | null;

/** Пропсы шторки выбора (вёрстка — у площадки, как у листа карточки). */
export interface SharePickSheetProps {
  title: string;
  options: { id: ShareVariant; label: string; hint?: string }[];
  /** Выбран вариант: шторка закрывается, открывается его лист. */
  onPick: (id: ShareVariant) => void;
  onClose: () => void;
  zIndex?: number;
}

export interface ShareTwoOptionsProps {
  share: ShareOpen;
  setShare: (v: ShareOpen) => void;
  shortProps: SheetProps | null;
  fullProps: (SheetProps & { hint?: string }) | null;
  /** Подпись краткого варианта в шторке и что на карточке */
  shortLabel: string;
  shortHint: string;
  /** Подпись полного варианта; что на карточке — fullProps.hint */
  fullLabel: string;
  zIndex?: number;
  /** Площадка: лист карточки, шторка выбора и тихая ссылка (подпись + клик). */
  Sheet: ComponentType<ShareCardSheetProps>;
  Picker: ComponentType<SharePickSheetProps>;
  Link: ComponentType<{ label: string; onClick: () => void }>;
}

export function ShareTwoOptions({
  share,
  setShare,
  shortProps,
  fullProps,
  shortLabel,
  shortHint,
  fullLabel,
  zIndex,
  Sheet,
  Picker,
  Link,
}: ShareTwoOptionsProps) {
  if (!shortProps && !fullProps) return null;
  const close = () => setShare(null);
  const open = () =>
    setShare(shortProps && fullProps ? 'pick' : shortProps ? 'short' : 'full');

  return (
    <>
      <Link label="Поделиться →" onClick={open} />
      {share === 'pick' && shortProps && fullProps && (
        <Picker
          title="Чем поделиться?"
          options={[
            { id: 'short', label: shortLabel, hint: shortHint },
            { id: 'full', label: fullLabel, hint: fullProps.hint },
          ]}
          onPick={setShare}
          onClose={close}
          zIndex={zIndex}
        />
      )}
      {share === 'short' && shortProps && (
        <Sheet {...shortProps} zIndex={zIndex} onClose={close} />
      )}
      {share === 'full' && fullProps && (
        <Sheet {...fullProps} zIndex={zIndex} onClose={close} />
      )}
    </>
  );
}
