import type { Tr } from '../types';
import { detachedVoice } from './detachedProtectorArntz';
import { dpY3, dpY3Voice } from './detachedProtectorYoung3';

/** Реплики detached_protector, вынесенные из detachedProtector.ts ради храповика размера (порядок прежний). */
export const detachedVoiceBase = (tr: Tr): string[] => [
  tr(
    'Ты рассказываешь о тяжёлом, а чувств я не слышу. Помоги мне понять, от чего эта защита берегла тебя в детстве.',
    'Вы рассказываете о тяжёлом, а чувств я не слышу. Помогите мне понять, от чего эта защита берегла вас в детстве.',
  ),
  tr(
    'Что ты замечаешь в теле прямо сейчас?',
    'Что вы замечаете в теле прямо сейчас?',
  ),
];

export const detachedVoiceFull = (tr: Tr): string[] => [
  ...detachedVoice(tr, detachedVoiceBase(tr)),
  ...dpY3Voice(tr),
];

export const detachedProtectorCambridgeBMore: string[] = [
  'После договора с Защитником клиент пересаживается к терапевту. Первый ход — нормализовать: любому в такой ситуации было бы не по себе, а здесь это ещё и старая боль — снова остаться без опоры и под угрозой [Кембридж, бокс 8.12].',
  ...dpY3,
];
