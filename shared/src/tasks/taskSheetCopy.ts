// Подписи листа «Новое задание» по тому, кто ставит. Терапевт назначает
// задание клиенту (есть clientId), клиент ставит цель себе («+ Поставить цель»
// в «Практике», clientId нет). До QA мобильной версии 2026-11 (М8) клиент
// видел язык терапевта: «Новое задание», «Назначить задание», «Назначаю…» —
// он никому ничего не назначает. Одна точка для листов сайта и мини-аппа.
import type { UserId } from '../userId';
import { taskSheetTitle } from '../therapy/therapistLinkCopy';

export interface TaskSheetCopy {
  /** Надзаголовок листа. */
  title: string;
  /** Что выбирают: «Выбери цель» / «Выбери задание» (винительный). */
  what: string;
  /** Подпись поля своего текста. */
  textLabel: string;
  /** Ошибка «текст пуст» у своего варианта. */
  emptyText: string;
  submit: string;
  saving: string;
}

type Tr = (ty: string, vy: string) => string;

export function taskSheetCopy(clientId: UserId | undefined, clientName: string | null | undefined, tr: Tr): TaskSheetCopy {
  if (clientId === undefined) {
    return {
      title: 'Новая цель',
      what: 'цель',
      textLabel: 'Описание цели',
      emptyText: tr('Опиши цель', 'Опишите цель'),
      submit: 'Поставить цель',
      saving: 'Сохраняю…',
    };
  }
  return {
    title: taskSheetTitle(clientName),
    what: 'задание',
    textLabel: 'Описание задания',
    emptyText: tr('Введи описание задания', 'Введите описание задания'),
    submit: 'Назначить задание',
    saving: 'Назначаю…',
  };
}
