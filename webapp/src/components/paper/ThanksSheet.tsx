// Тёплый лист «спасибо» (docs/design/APP_2026-11.md, b28): возврат с оплаты подписки (?sub=ok), доната
// (?donation=ok) и отменённая подписка. Это PaperOutcome на соломе (70 — подписка и донат), только в
// полосе вместо одинокого знака — сцена FinalCorners лендинга: полоски поднимаются из края листа, сверху
// лист растения и камешек — «заметили, записали, растёт». Одно главное действие обязательно: у «спасибо»
// доната его не было, и экран оставался тупиком. Тексты передаёт страница — своих слов у листа нет.
import type { ReactNode } from 'react';
import type { Look } from '../../../../shared/src/theme/entityLook';
import { FinalCorners } from '../art/SceneParts';
import { PaperOutcome, type OutcomeAction } from './PaperOutcome';
import '../../styles/thanks-sheet.css';

/** Солома и лист — вид «спасибо»; знак остаётся в data-sign листа, полосу рисует сцена. */
const THANKS_LOOK: Look = { hue: 70, sign: 'leaf' };

export interface ThanksSheetProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** Главное действие — ссылка или кнопка: лист «спасибо» без него — тупик. */
  action: OutcomeAction;
  link?: OutcomeAction;
}

export function ThanksSheet({ eyebrow, title, lead, action, link }: ThanksSheetProps) {
  return (
    <PaperOutcome
      outcome={THANKS_LOOK} className="pa-thanks" art={<FinalCorners hue={THANKS_LOOK.hue} />}
      eyebrow={eyebrow} title={title} lead={lead} action={action} link={link}
    />
  );
}
