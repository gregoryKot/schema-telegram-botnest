// Итог письма себе в детстве (LetterEx, b18): «Запечатать письмо» обещало запечатать — лист «готово» на
// сирени письма со сценой SceneLetter sealed (конверт с печатью ChildCare), под ней — само письмо на белом
// листе (начало, полностью — по «Изменить»), дата и число слов. «Закрыть» — залитая, «Изменить» — тихая
// ссылка. Прошлые письма — строками со знаком Sheets (на компьютере колонкой справа). Рамку экрана
// (ex2-screen, ExBar) рисует LetterEx: там же useHistorySheet.
import { DoneSheet } from '../paper/DoneSheet';
import { SceneLetter } from '../art/SceneLetter';
import { SignArt } from '../art/SignArt';
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
    <div className={others.length > 0 ? 'ex2-done-page ex2-done-page--side' : 'ex2-done-page'}>
      <DoneSheet entity="letter" scene={<SceneLetter sealed />} titleAs="h1"
        label="Письмо · сохранено" title={<>Письмо <span className="it">написано.</span></>} sub={lede}
        primary={{ label: 'Закрыть', onClick: onClose }} secondary={{ label: 'Изменить', onClick: onEdit }}>
        <div className="ex2-letter ex2-letter--sealed">
          <div className="ex2-letter-hi">Здравствуй,</div>
          <div className="ex2-letter-text">{text}</div>
          <div className="ex2-meta"><span>{date}</span><span>{wordsLabel(text)}</span></div>
        </div>
      </DoneSheet>
      {others.length > 0 && (
        <section className="ex2-done-side">
          <div className="ds-label">Прошлые письма · {others.length}</div>
          {others.slice(0, 2).map((l) => (
            <div key={l.id} className="ex2-past">
              <SignArt sign="sheets" size="row" />
              <div className="ex2-past-body">
                <span className="ex2-past-date">{fmtAgo(l.createdAt)}</span>
                <span className="ex2-past-snip">«{l.text.slice(0, 120)}…»</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
