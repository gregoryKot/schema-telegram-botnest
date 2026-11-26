import { api } from '../../api';
import { CrisisCardView } from '../../../../shared/src/components/CrisisCard';
import { detectCrisisAny } from '../../../../shared/src/utils/crisisMarkers';
import { Heart } from '../art/PaperArtSigns';

// Визитка целиком на «вы» (соседние тексты формы: «Ваше имя», «хотите разобраться»); формы обращения нет.
const vy = (_ty: string, vyText: string) => vyText;

/**
 * Кризисная карточка для свободного текста формы записи (правило №7): под полем
 * «Запрос» и на экране «Заявка отправлена» — человек, написавший «не хочу жить»,
 * не должен остаться с «отвечу утром». Детекция на клиенте, до отправки; карточка
 * ничего не блокирует и не отправляет. Показ/нажатие уходят анонимным путём
 * (trackPublicEvent, surface=booking): POST /api/event посетителю без входа закрыт. Знак Heart — как в кабинете. */
export function BookingCrisisNote({ text }: { text: string }) {
  if (!detectCrisisAny(text)) return null;
  return <div style={{ textAlign: 'left' }}><CrisisCardView surface="booking" art={<Heart size="row" />} tr={vy} track={api.trackPublicEvent} /></div>;
}
