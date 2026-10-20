import { api } from '../../api';
import { useIsMobile } from '../../components/useIsMobile';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { useTodayCustomization as useSharedTodayCustomization } from '../../../../shared/src/today/useTodayCustomization';
import { useLongPress } from '../../../../shared/src/hooks/useLongPress';

// Настройка экрана «Сегодня» — логика общая с мини-аппом
// (shared/today/useTodayCustomization): ключи localStorage и события
// аналитики те же, поэтому выбор один на обе площадки. Здесь транспорт сайта
// (аналитика, точка синхронизации) и долгое нажатие на блок — быстрый путь к
// его строке в листе (как в мини-аппе). Жест только на телефоне: на десктопе он
// гасил бы правый клик по карточкам, а «Настроить экран» там есть в шапке.
export function useTodayCustomization() {
  const today = useSharedTodayCustomization({ api, onChanged: notifyPrefsChanged });
  const { openByHold } = today;
  const phone = useIsMobile();
  const focus = useLongPress(() => openByHold('practice'));
  const streak = useLongPress(() => openByHold('streak'));
  const phrase = useLongPress(() => openByHold('phrase'));
  return {
    ...today,
    holdFocus: phone ? focus : undefined,
    holdStreak: phone ? streak : undefined,
    holdPhrase: phone ? phrase : undefined,
  };
}

export type TodayCustomization = ReturnType<typeof useTodayCustomization>;
