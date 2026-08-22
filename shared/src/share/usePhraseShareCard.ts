// Состояние блока «Фраза для себя» (случайная фраза Здорового Взрослого +
// шэр карточкой) — общее для обоих фронтендов (правило №3). Продублировано
// 1-в-1 при переносе на сайт; вёрстка остаётся своя.
// getHealthyPhrase — стабильная ссылка на метод api-модуля площадки
// (`api.getHealthyPhrase`), не инлайн-стрелка: она попадает в зависимости
// эффекта загрузки, и новая ссылка на каждый рендер зациклила бы запросы.
import { useCallback, useEffect, useState } from 'react';
import { drawPhraseCard } from './cards/phraseCard';

export interface PhraseShareCardState {
  phrase: string | null;
  loading: boolean;
  showShare: boolean;
  setShowShare: (v: boolean) => void;
  /** Запросить новую фразу (кнопка «Другая ↻») — сама выставляет loading. */
  reload: () => void;
  draw: (canvas: HTMLCanvasElement) => void;
}

export function usePhraseShareCard(
  getHealthyPhrase: () => Promise<{ text: string | null }>,
): PhraseShareCardState {
  const [phrase, setPhrase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  // Без setLoading(true) внутри: на монтировании loading уже true, а
  // синхронный setState прямо в теле эффекта запускает лишний каскад
  // ререндеров (react-hooks/set-state-in-effect). reload() — единственное
  // место, которое честно возвращает скелетон перед повторным запросом.
  const fetchPhrase = useCallback(() => {
    getHealthyPhrase()
      .then((r) => setPhrase(r.text))
      .catch(() => setPhrase(null))
      .finally(() => setLoading(false));
  }, [getHealthyPhrase]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchPhrase();
  }, [fetchPhrase]);

  useEffect(fetchPhrase, [fetchPhrase]);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (phrase) drawPhraseCard(canvas, phrase);
    },
    [phrase],
  );

  return { phrase, loading, showShare, setShowShare, reload, draw };
}
