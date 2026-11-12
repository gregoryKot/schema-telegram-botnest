import { glue } from '../../../../shared/src/utils/typo';

/** Заголовки моста: общий glue и точечно — «это» не остаётся в конце строки («Нести это / в одиночку…»):
 *  трёхбуквенные слова glue не клеит, строка-источник не меняется — пробел после «это» неразрывный при отрисовке. */
export function glueBridge(text: string): string {
  return glue(text).replace(/(^|[\s\u00a0])(это) /gi, '$1$2\u00a0');
}
