// Вердикт разбора: чистая функция от отмеченных примет критика — их числа и того,
// осталось ли во фразе хоть что-то «про дело».
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

// У заботы эти три приметы говорят «про дело»: позиция «со мной всё в порядке», речь о поступке,
// факты вместо суда. Все три у критика — дела во фразе нет («я ничтожество»), сколько бы примет ни набралось.
const DEED_MARKS: readonly PhraseMarkId[] = ['notok', 'person', 'label'];

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
  if (count <= 2) {
    return {
      emoji: '🙂',
      title: 'Почти забота',
      text: 'Одна-две приметы критика, остальное по делу. Обычно достаточно поправить эту часть, и фраза начинает помогать.',
      suggestRewrite: true,
    };
  }
  if (count <= 6 && DEED_MARKS.every((m) => known.has(m))) {
    return {
      emoji: '⚖️',
      title: 'Говорит критик',
      text: 'Про дело в этой фразе ничего нет: она судит человека целиком. Пользы в ней нет, только стыд, а он ничего не чинит.',
      suggestRewrite: true,
    };
  }
  if (count <= 6) {
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
    text: 'Почти вся таблица самокритики целиком. Пользы в такой фразе нет — только стыд, а он ничего не чинит.',
    suggestRewrite: true,
  };
}
