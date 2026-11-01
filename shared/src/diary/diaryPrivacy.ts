import type { TherapyRelationInfo } from '../apiTypes';

// Кто видит записи дневника — строка обещания в листе записи. До 2026-10-26
// там всегда стояло «Никто кроме вас не увидит», а подключённый терапевт видел
// записи («Записи клиента», «Последние записи клиента» на «Обзоре»).
//
// Правило то же, что у сервера (`getClientDiaryEntries`,
// src/therapy/therapy-client-data.service.ts): терапевт видит дневники при
// активной связи, пока клиент не выключил в настройках «Карточки схем и
// режимов» (`therapistShareCards === false`). Пока связь или настройки не
// загрузились — обещания нет совсем (null): лучше промолчать, чем соврать.

type Tr = (ty: string, vy: string) => string;

export type DiaryAccess = 'private' | 'therapist-sees' | 'therapist-hidden';

export function diaryAccess(
  relation: TherapyRelationInfo | null | undefined,
  shareCards: boolean | undefined,
): DiaryAccess | null {
  if (relation === undefined) return null;
  if (relation === null) return 'private';
  // Связь «я терапевт» говорит о моих клиентах, а не о том, кто видит мой
  // дневник, — честного ответа у неё нет.
  if (relation.role !== 'client') return null;
  if (shareCards === undefined) return null;
  return shareCards === false ? 'therapist-hidden' : 'therapist-sees';
}

export function diaryPrivacyNote(access: DiaryAccess, tr: Tr): string {
  if (access === 'therapist-sees')
    return tr(
      'Записи видит и твой терапевт — закрыть можно в настройках, «Мой терапевт»',
      'Записи видит и ваш терапевт — закрыть можно в настройках, «Мой терапевт»',
    );
  if (access === 'therapist-hidden')
    return tr(
      'Никто кроме тебя не увидит: терапевту доступ к записям закрыт в настройках',
      'Никто кроме вас не увидит: терапевту доступ к записям закрыт в настройках',
    );
  return tr('Никто кроме тебя не увидит', 'Никто кроме вас не увидит');
}
