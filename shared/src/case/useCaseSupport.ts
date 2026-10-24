import { useEffect, useRef, useState } from 'react';
import { haptic } from '../host/haptic';

/**
 * Ручное открытие карточки поддержки строкой «Тяжело прямо сейчас →».
 *
 * Регрессия прода (фидбек владельца 2026-08-31, с телефона: «кнопка плохо
 * сейчас просто кидает на главную»): строка звала onHardNow, которым обе
 * площадки закрывали поток целиком — кризисный путь (правило №7 CLAUDE.md)
 * выбрасывал человека из разбора вместо помощи. Теперь поведение живёт
 * внутри общего состояния потока: тап показывает CrisisCard на месте,
 * «Вернуться к разбору ▲» прячет её, шаг и черновик не трогаются.
 *
 * Карточка от текстовой детекции (crisis в useCaseFlowState) — отдельный,
 * постоянный показ: closeSupport её не прячет.
 */
export function useHardNowSupport() {
  const [hardNow, setHardNow] = useState(false);
  const handleHardNow = () => {
    haptic.tap();
    setHardNow(true);
  };
  const closeSupport = () => {
    haptic.tap();
    setHardNow(false);
  };
  return { hardNow, handleHardNow, closeSupport };
}

/**
 * Прокрутка к карточке поддержки при ручном открытии: лист длинный, карточка
 * рендерится внизу — без прокрутки тап по строке выглядит как «ничего не
 * произошло». Optional-вызов: jsdom (vitest) scrollIntoView не реализует.
 */
export function useSupportCardReveal(open: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  return ref;
}
