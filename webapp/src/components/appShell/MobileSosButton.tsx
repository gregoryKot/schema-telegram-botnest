import { hueStyle } from '../../lib/tone';
import { useTextEntryFocus } from '../../hooks/useTextEntryFocus';
import '../../styles/mobile-sos.css';

// Вход в кризисную помощь на телефоне (QA 2026-11, C-К1). Шапки на телефоне нет, и
// «Мне плохо» из неё пропадала: теперь плавающая кнопка над нижней панелью открывает
// тот же лист, что кнопка топбара на десктопе, — одним тапом, поверх текущего раздела.
// На десктопе скрыта стилем (там есть топбар). Под экранной клавиатурой не нужна.
export function MobileSosButton({ onOpen }: { onOpen: () => void }) {
  const typing = useTextEntryFocus();
  if (typing) return null;
  return (
    <button type="button" className="mobile-sos tone-tint" style={hueStyle(28)} onClick={onOpen}>
      Мне плохо
    </button>
  );
}
