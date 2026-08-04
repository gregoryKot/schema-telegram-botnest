// Вердикт разбора: чистая функция от числа отмеченных примет критика.
// Логика отдельно от JSX — её проверяет verdict.test.ts, а не рендер-тест.
//
// Приговора «ты плохой» здесь нет ни в одном варианте: задача упражнения —
// научить слышать разницу, а не выдать оценку. Поэтому даже на четырёх
// приметах формулировка про фразу, а не про человека.
import { PHRASE_CRITERIA, type PhraseMarkId } from './criteria';

export interface PhraseVerdict {
  emoji: string;
  title: string;
  text: string;
  /** Стоит ли предлагать переписать фразу */
  suggestRewrite: boolean;
}

export function buildVerdict(marks: PhraseMarkId[]): PhraseVerdict {
  const known = new Set(
    marks.filter((m) => PHRASE_CRITERIA.some((c) => c.id === m)),
  );
  const count = known.size;

  if (count === 0) {
    return {
      emoji: '🌤',
      title: 'Это самокоррекция',
      text: 'Голос говорит про дело и оставляет силы. Такую фразу переписывать незачем — её стоит запомнить как образец.',
      suggestRewrite: false,
    };
  }
  if (count === 1) {
    return {
      emoji: '🙂',
      title: 'Почти забота',
      text: 'Одна примета критика — остальное по делу. Обычно достаточно поправить эту часть, и фраза начинает помогать.',
      suggestRewrite: true,
    };
  }
  if (count <= 3) {
    return {
      emoji: '🎭',
      title: 'Голос смешанный',
      text: 'Часть фразы про дело, часть — уже приговор. Такие фразы звучат убедительно: правда в них есть, но помогать они перестают.',
      suggestRewrite: true,
    };
  }
  return {
    emoji: '⚖️',
    title: 'Говорит критик',
    text: 'Все четыре приметы на месте. Пользы в такой фразе нет — только стыд, и он ничего не чинит.',
    suggestRewrite: true,
  };
}
