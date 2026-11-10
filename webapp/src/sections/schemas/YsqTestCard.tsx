import type { CSSProperties } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignHero } from '../../components/paper/SignHero';
import { fmtDate, momentDayKey } from '../../utils/format';
import { useTr } from '../../utils/addressForm';

interface Props {
  progressAnswered: number | null;
  completedAt: string | null;
  onStart: () => void;
}

const YSQ = ENTITY_LOOK.ysq;

/** Плитка теста YSQ (компьютер): бумага и знак теста из ENTITY_LOOK (глина + слои крупно, с тенью-вырезкой),
 *  подпись Literata и одно действие — пройти / продолжить / посмотреть результаты. */
export function YsqTestCard({ progressAnswered, completedAt, onStart }: Props) {
  const tr = useTr();
  // Незаконченный прогресс приоритетнее результата: кнопка ведёт в тест на
  // сохранённый вопрос (autoResume), поэтому и подпись — «продолжить».
  const action = progressAnswered !== null
    ? `продолжить (${progressAnswered} из 116) →`
    : completedAt
      ? `пройден ${fmtDate(momentDayKey(completedAt))} · результаты →`
      : 'Начать →';
  const text = progressAnswered !== null
    ? 'Тест начат – прогресс сохранён, можно продолжить с того же места'
    : completedAt
      ? 'Результаты, история прохождений и «поделиться» – внутри'
      : tr('Определи схемы автоматически – 116 вопросов, 10 минут', 'Определите схемы автоматически – 116 вопросов, 10 минут');
  return (
    <div className="pp-paper cs-test" style={{ '--h': YSQ.hue } as CSSProperties}>
      <div className="cs-test-body">
        <div className="ds-label cs-test-label">Тест на схемы</div>
        <p className="cs-test-text">{text}</p>
        <button className="ds-btn ds-btn--secondary cs-test-btn" onClick={onStart}>{action}</button>
      </div>
      <div className="cs-test-art" aria-hidden="true"><SignHero sign={YSQ.sign} /></div>
    </div>
  );
}
