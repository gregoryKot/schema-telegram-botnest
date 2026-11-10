// Кнопки листа «Дыши со мной» по этапу (BreathingPaperView): одно главное действие на этап.
import type { BreathingViewProps } from '../../../../shared/src/practices/createBreathingCard';

type ActionProps = Pick<BreathingViewProps, 'stage' | 'text' | 'start' | 'stop' | 'onClose'>;

/** Покой: «Начать дыхание» (+ «Закрыть» в листе); идёт: тихое «Достаточно»; итог: в листе
 *  «Закрыть» залитая и «Ещё минуту» ссылкой, на странице — «Ещё минуту» контурной. */
export function BreathActions({ stage, text, start, stop, onClose }: ActionProps) {
  const main = 'ds-btn ds-btn--lg qb-main';
  const quiet = 'ds-link pa-quiet pa-quiet--pad'; // тихая ссылка — одна на листы бумаги (paper-app.css)
  if (stage === 'active') return <button type="button" className={quiet} onClick={stop}>{text.action}</button>;
  if (stage === 'idle') {
    return (
      <>
        <button type="button" className={main} onClick={start}>{text.action}</button>
        {onClose && <button type="button" className={quiet} onClick={onClose}>Закрыть</button>}
      </>
    );
  }
  return onClose ? (
    <>
      <button type="button" className={main} onClick={onClose}>Закрыть</button>
      <button type="button" className={quiet} onClick={start}>{text.action}</button>
    </>
  ) : (
    <button type="button" className={`${main} ds-btn--secondary`} onClick={start}>{text.action}</button>
  );
}
