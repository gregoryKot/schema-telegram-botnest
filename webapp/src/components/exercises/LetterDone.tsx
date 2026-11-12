// Итог письма себе в детстве (LetterEx, b18): «Запечатать письмо» обещало запечатать — лист «готово» на
// сирени письма со сценой SceneLetter sealed (конверт с печатью ChildCare), под ней — само письмо на белом
// листе (начало, полностью — по «Изменить»), дата и число слов. «Закрыть» — залитая, «Изменить» — тихая
// ссылка. Прошлые письма — строками ExPastRow со знаком Sheets (на компьютере колонкой справа). Рамка — общая
// ExDonePage; useHistorySheet — в LetterEx (onClose — его goBack).
import { DoneSheet } from '../paper/DoneSheet';
import { SceneLetter } from '../art/SceneLetter';
import { ExDonePage, ExPastList, ExPastRow } from './ExDonePage';
import { fmtAgo } from '../../utils/format';
import { wordsLabel } from './letterWords';
import type { api } from '../../api';

type Letter = Awaited<ReturnType<typeof api.getLetters>>[number];

export function LetterDone({ text, others, lede, onEdit, onClose }: {
  text: string;
  others: Letter[];
  lede: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <ExDonePage onBack={onClose} side={others.length > 0 && (
      <ExPastList label={<>Прошлые письма · {others.length}</>}>
        {others.slice(0, 2).map((l) => (
          <ExPastRow key={l.id} sign="sheets" date={fmtAgo(l.createdAt)} quote={`${l.text.slice(0, 120)}…`} />
        ))}
      </ExPastList>
    )}>
      <DoneSheet entity="letter" scene={<SceneLetter sealed />} titleAs="h1"
        label="Письмо · сохранено" title={<>Письмо <span className="it">написано.</span></>} sub={lede}
        primary={{ label: 'Закрыть', onClick: onClose }} secondary={{ label: 'Изменить', onClick: onEdit }}>
        <div className="ex2-letter ex2-letter--sealed">
          <div className="ex2-letter-hi">Здравствуй,</div>
          <div className="ex2-letter-text">{text}</div>
          <div className="ex2-meta"><span>{date}</span><span>{wordsLabel(text)}</span></div>
        </div>
      </DoneSheet>
    </ExDonePage>
  );
}
