import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { YsqTherapyCta as SharedCta } from '../../../../shared/src/components/YsqTherapyCta';
import type { ContactCta } from '../../../../shared/src/utils/therapistContact';

interface Props {
  cta: ContactCta;
}

// Обёртка над общим CTA (shared, правило №3): даёт miniapp-useTr и трекинг
// перехода на сайт практики (правило №8, place 'ysq_result').
export function YsqTherapyCta({ cta }: Props) {
  const tr = useTr();
  return (
    <SharedCta
      cta={cta}
      tr={tr}
      onLinkClick={() =>
        api.trackPublicEvent('practice_link_click', { place: 'ysq_result' })
      }
    />
  );
}
