import { rescriptVoice } from './arntzBpdImageryMore';
import * as camb from './imageryRescriptingCambridge';
import type { Tr } from '../types';

export const imageryVoice = (tr: Tr): string[] =>
  rescriptVoice(tr, camb.imageryRescriptingVoice(tr));

/** Дополнение к imagery_rescripting по гл. 8 Арнца и ван Гендерен о ПРЛ: вынесено, чтобы imageryArntz.ts не рос. */
export const imageryTraumaBpd: string[] = [
  ...camb.imageryRescriptingCambridgeMore,
  'Почему к травме идут с уже знакомым методом [Арнтц ПРЛ, гл. 8]. Рескрипцию раньше применяют для поиска истоков режимов и на фазе изменения схем, поэтому к работе с травмой она уже опробована.',
  'Клиенту, который не хочет ворошить прошлое, объясняют: постоянные напоминания о травме сами усиливают схемы, а последствия — кошмары, плохая концентрация — не уйдут, пока травму не переработали [Арнтц ПРЛ, гл. 8].',
];
