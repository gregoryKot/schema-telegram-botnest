import { useState } from 'react';

// Оверлеи раздела «Помощь»: десять листов-практик плюс интро схемы/режима.
// Все они устроены одинаково — булев флаг и закрытие по onClose, — поэтому
// живут одним хуком, а не десятком useState в теле секции.
// Вынесено из HelpSection.tsx (правило №10).
export type HelpOverlayId =
  | 'flashcard'
  | 'grounding'
  | 'stop'
  | 'crisis'
  | 'selfHelp'
  | 'beliefCheck'
  | 'phraseCheck'
  | 'letterToSelf'
  | 'safePlace'
  | 'warmWords';

export function useHelpOverlays() {
  const [open, setOpen] = useState<Record<HelpOverlayId, boolean>>({
    flashcard: false,
    grounding: false,
    stop: false,
    crisis: false,
    selfHelp: false,
    beliefCheck: false,
    phraseCheck: false,
    letterToSelf: false,
    safePlace: false,
    warmWords: false,
  });
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId, setIntroModeId] = useState<string | null>(null);

  const show = (id: HelpOverlayId) =>
    setOpen((prev) => ({ ...prev, [id]: true }));
  const hide = (id: HelpOverlayId) =>
    setOpen((prev) => ({ ...prev, [id]: false }));

  return {
    open,
    show,
    hide,
    introSchemaId,
    setIntroSchemaId,
    introModeId,
    setIntroModeId,
  };
}

export type HelpOverlaysState = ReturnType<typeof useHelpOverlays>;
