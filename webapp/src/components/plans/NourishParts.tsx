// Части «Что меня питает» (PracticesScreen, b20): строка действия со знаком Leaf (сущность «Что питает» из
// ENTITY_LOOK) и тихой ссылкой «удалить» (красная ссылка в каждой строке кричала; подтверждение — вторым тапом,
// тогда — тоном ошибки), оценка потребности за сегодня — полоской длины n/10 цветом данных потребности (вместо
// цифры во вкладке без подписи).
import type { CSSProperties } from 'react';
import { SignArt } from '../art/SignArt';
import { glueSpaces } from '../../../../shared/src/utils/typo';

export function NourishRow({ text, pending, onDelete }: { text: string; pending: boolean; onDelete: () => void }) {
  return (
    <div className="ds-card ds-card--row sk-practice">
      <span className="pp-row-art" aria-hidden="true"><SignArt sign="leaf" size="row" /></span>
      <div className="sk-practice-text">{glueSpaces(text)}</div>
      <button type="button" onClick={onDelete} className={'ds-link sk-practice-del' + (pending ? ' is-pending' : '')}>
        {pending ? 'Точно удалить?' : 'удалить'}
      </button>
    </div>
  );
}

/** Оценка за сегодня полоской; число — для чтения с экрана. */
export function NeedScore({ score }: { score: number }) {
  const v = Math.max(0, Math.min(10, score));
  return (
    <span className="sk-need-score" role="img" aria-label={`${v}/10`} style={{ '--score': `${v * 10}%` } as CSSProperties}>
      <i />
    </span>
  );
}
