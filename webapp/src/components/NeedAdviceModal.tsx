import { getTherapistContact } from '../utils/therapistContact';
import { BottomSheetShell } from './BottomSheetShell';
import { EntitySheet } from './paper/EntitySheet';
import { SignArt } from './art/SignArt';
import { ExternalLink } from '../host/ExternalLink';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useNeedData } from '../needData';
import { ENTITY_LOOK, needLook, type SheetLook } from '../../../shared/src/theme/entityLook';
import { NEED_ORDER, type NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tracker.css';

// Оверлей «О советах» под шитами потребности — общий для NeedHistorySheet и
// NeedTodaySheet (правило №11: один и тот же блок жил дословно в обоих). Своя запись
// истории: «Назад» закрывает шторку, а не лист потребности под ней.
// Вид (редизайн 2026-11, b07): сверху та же шапка потребности — её бумага и знак (EntitySheet
// compact), запись к терапевту — строкой со знаком «Поговорить», «Понятно» — кнопкой во всю ширину.
const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему, рядом с живым человеком.',
];

const lookOf = (needId?: string): SheetLook =>
  needId && (NEED_ORDER as readonly string[]).includes(needId) ? needLook(needId as NeedId) : { hue: ENTITY_LOOK.tracker.hue };

export function NeedAdviceModal({ onClose, needId }: { onClose: () => void; needId?: string }) {
  const contact = getTherapistContact();
  const goBack = useHistorySheet(onClose);
  const NEED_DATA = useNeedData();
  const needName = needId ? NEED_DATA[needId]?.name : undefined;
  return (
    <BottomSheetShell goBack={goBack} zIndex={300}>
      <EntitySheet look={lookOf(needId)} label={needName} title="О советах" compact className="tk2-adv-head" />
      <div className="tk2-adv-body">
        {DISCLAIMER_CONTENT.map((p, i) => <p key={i} className="tk2-adv-p">{p}</p>)}
      </div>
      {/* Терапевту не предлагаем ссылку на самого себя; без канала — некуда (З6). */}
      {!contact.isTherapist && contact.url && (
        <ExternalLink href={contact.url} className="tk2-adv-link">
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK.therapist.sign} size="row" /></span>
          → Записаться на консультацию</ExternalLink>
      )}
      <button type="button" onClick={goBack} className="ds-btn ds-btn--secondary tk2-adv-ok">
        Понятно
      </button>
    </BottomSheetShell>
  );
}
