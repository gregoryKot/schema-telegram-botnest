import { Layers } from '../../components/art/PaperArt';
import { fmtDate, momentDayKey } from '../../utils/format';
import { useTr } from '../../utils/addressForm';

interface Props {
  progressAnswered: number | null;
  completedAt: string | null;
  onStart: () => void;
}

/** Карточка цветной бумаги про тест YSQ: пройти / продолжить / посмотреть результаты. */
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
    <div className="pp-paper cs-test">
      <div className="cs-test-head"><div className="ds-label">Тест на схемы</div><Layers size="row" /></div>
      <p className="cs-test-text">{text}</p>
      <button className="ds-btn ds-btn--secondary cs-test-btn" onClick={onStart}>{action}</button>
    </div>
  );
}
