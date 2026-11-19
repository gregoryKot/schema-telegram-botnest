import { useEffect, useState } from 'react';

/** Низкий телефон (360×640, 390×664): вопрос трекера ужимается, чтобы пять ответов встали на первый экран.
 *  То же условие — в styles/tracker-question.css. */
export const LOW_PHONE_MEDIA = '(max-width: 560px) and (max-height: 700px)';

const lowPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(LOW_PHONE_MEDIA).matches;

/** True на низком телефоне; следит за поворотом и размером окна. */
export function useLowPhone(): boolean {
  const [low, setLow] = useState(lowPhone);
  useEffect(() => {
    const update = () => setLow(lowPhone());
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);
  return low;
}
