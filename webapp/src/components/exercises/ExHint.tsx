// Подсказка упражнения («Совет», «Подсказка», «С чего начать», пояснение шага) — один примитив на всю группу
// (ревью g6, APP_2026-11.md, принцип 5): до сведения у неё было три вида — DiaryAside после формы (карточки),
// свёрнутая NeedFold до поля (проверка убеждения) и развёрнутая наклейка соломы до поля (письмо, место), и
// наклейка в 250px отодвигала первое поле на телефоне за сгиб. Теперь — тихая раскрывашка NeedFold (вид
// sd-why): на компьютере раскрыта (в колонке разворота под листом или в колонке справа), на телефоне —
// свёрнутой строкой «подпись · заголовок Literata ⌄». Место в раскладке задаёт экран (aside ExScreen).
import type { ReactNode } from 'react';
import { NeedFold } from '../NeedFold';
import { isPhoneLayout } from '../../utils/phoneLayout';
import { glueIf } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-diary.css';

export function ExHint({ label = '', title, children }: {
  /** Капитель перед заголовком («Совет»); пусто — не рисуется (у шага уже стоит «Шаг N из 4»). */
  label?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <NeedFold className="sd-why ex2-hint" title={label} defaultOpen={!isPhoneLayout()}
      sub={<span className="sd-why-title">{glueIf(title)}</span>}>
      <div className="ex2-hint-body">{children}</div>
    </NeedFold>
  );
}

/** Абзац, вторая подпись («Подсказка», «Можно») и список внутри подсказки. */
export const ExHintText = ({ children }: { children: ReactNode }) => <p className="ex2-hint-text">{glueIf(children)}</p>;
export const ExHintSub = ({ children }: { children: ReactNode }) => <div className="ds-label ex2-hint-sub">{children}</div>;
export function ExHintList({ items }: { items: string[] }) {
  return <ul className="ex2-hint-list">{items.map((x) => <li key={x}>{glueIf(x)}</li>)}</ul>;
}
