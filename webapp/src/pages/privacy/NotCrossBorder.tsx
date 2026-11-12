import { P, Ul } from '../../legal/LegalLayout';
import { DOMESTIC_PROCESSORS, MEETING_NOTE, METRIKA_PROCESSOR, processorLine } from './processors';

// Глава 7 политики, сразу после перечня иностранных сервисов: то, что
// трансграничной передачей не является, — встреча в Zoom и календарь (данные
// клиента туда не уходят), российские сервисы и статистика посещений.
// Вынесено из PrivacyPage.tsx: страница упирается в потолок размера (правило
// №10). Текст юридический — правится только вместе с политикой и её тестами
// (PrivacyPage.test.tsx), перечни — в processors.ts.
export function NotCrossBorder() {
  return (
    <>
      <P>{MEETING_NOTE}</P>
      <P><strong>Российские сервисы.</strong> Письма и вход через Яндекс работают на серверах в России и трансграничной передачей не являются:</P>
      <Ul items={DOMESTIC_PROCESSORS.map(processorLine)} />
      <P><strong>Статистика посещений.</strong> {processorLine(METRIKA_PROCESSOR)}.</P>
    </>
  );
}
