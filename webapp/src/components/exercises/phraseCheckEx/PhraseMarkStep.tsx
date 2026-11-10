// Один шаг разбора: одна примета критика, два варианта ответа — «забота» или «критик». Логика вопросов —
// shared/src/phraseCheck. Вид (b18): фраза крупно наверху (PhraseSaid), вопрос — заголовком, варианты —
// одинаковые нейтральные плитки бумаги страницы: заранее окрашенные мятой и розой, они подсказывали ответ.
// Пояснение приметы и её номер — один раз, в подсказке рядом (aside PhraseCheckEx; на телефоне — после
// вариантов), а не ещё раз под вариантами; ход разбора — бусины на листе героя.
import { PHRASE_CRITERIA, type PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { PhraseSaid } from './PhraseSaid';

export function PhraseMarkStep({
  index,
  phrase,
  onAnswer,
}: {
  index: number;
  phrase: string;
  /** critic=true — примета засчитана как голос критика */
  onAnswer: (id: PhraseMarkId, critic: boolean) => void;
}) {
  const c = PHRASE_CRITERIA[index];
  return (
    <>
      <PhraseSaid text={phrase} />
      <div className="ex2-prompt-label ex2-prompt-label--sm">{c.question}</div>
      <div className="ex2-choices">
        <button type="button" className="ex2-choice" onClick={() => onAnswer(c.id, false)}>{c.care}</button>
        <button type="button" className="ex2-choice" onClick={() => onAnswer(c.id, true)}>{c.critic}</button>
      </div>
    </>
  );
}
