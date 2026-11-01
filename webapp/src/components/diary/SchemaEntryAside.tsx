import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { DiaryAside } from './DiaryStepCard';
import { useDiaryAccess } from '../../../../shared/src/diary/useDiaryAccess';
import { diaryPrivacyNote } from '../../../../shared/src/diary/diaryPrivacy';

// Боковая колонка визарда дневника схем: совет и что обещает лист. Строка
// «кто увидит» — по правилу сервера (shared/src/diary/diaryPrivacy.ts): с
// подключённым терапевтом «никто кроме вас» было неправдой. Пока связь и
// настройки не загрузились, строки нет.
export function SchemaEntryAside({ hue }: { hue: number }) {
  const tr = useTr();
  const access = useDiaryAccess(api.getTherapyRelation, api.getSettings);
  return (
    <DiaryAside hue={hue} eyebrow="Совет" title="Не обязательно по порядку">
      <p className="ds-sub">{tr('Если в моменте трудно – запиши только триггер и чувство. Остальное можно дополнить позже, или когда тебе кто-то поможет это разобрать.', 'Если в моменте трудно – запишите только триггер и чувство. Остальное можно дополнить позже, или когда вам кто-то поможет это разобрать.')}</p>
      <ul className="sd-aside-list">
        <li>Автосохранение на каждом шаге</li>
        <li>Можно вернуться и продолжить</li>
        {access && <li>{diaryPrivacyNote(access, tr)}</li>}
      </ul>
    </DiaryAside>
  );
}
