// «Зачем это?» у заметки к дню — вспомогательное тише главного (docs/design/APP_2026-11.md,
// принцип 5): на телефоне свёрнутой строкой между листом и полем (до поля только шапка),
// на компьютере — раскрыто под листом в колонке разворота. Раскрывается тапом, не наведением.
// Механика раскрытия — общая NeedFold; здесь только стартовое состояние и вид строки (.sd-why).
import { NeedFold } from './NeedFold';
import { isPhoneLayout } from '../utils/phoneLayout';
import { glue } from '../../../shared/src/utils/typo';

export function NoteWhy() {
  return (
    <NeedFold className="sd-why" title="Зачем это?" defaultOpen={!isPhoneLayout()}
      sub={<span className="sd-why-title">Рефлексия помогает</span>}>
      <p className="sd-why-body">{glue('Регулярные короткие записи помогают увидеть паттерны и понять, что происходит внутри.')}</p>
    </NeedFold>
  );
}
