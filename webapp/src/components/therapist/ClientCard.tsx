import type { CSSProperties } from 'react';
import { pressable } from '../../utils/a11y';
import type { TherapyClientSummary } from '../../api';
import { DOMAIN_HUE, clientHue, hueStyle } from '../../lib/tone';
import { NextSessionLine } from './NextSessionLine';
import { clientCaption, clientStatus, meetingLabel, schemaChips } from './rosterModel';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientSign } from './cabinetLook';
import { DomainMark } from '../DomainMark';
import { BrandMark } from '../art/BrandMark';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

interface Props {
  client: TherapyClientSummary;
  today: string;
  onOpen: (client: TherapyClientSummary) => void;
}

// Карточка в «Все клиенты» (b29, r1): лист .pp-leaf с тенью бумаги ведущего домена (без домена — небо), аватар
// .ds-avatar--paper; знак — DomainArt ведущего домена или BrandMark офлайн-клиента — в строке имени; «в приложении» /
// «офлайн» — тихий текст без плашки. Схемы — чипы бумаги домена, встреча — NextSessionLine, как в шапке карточки.
export function ClientCard({ client, today, onOpen }: Props) {
  const name = clientDisplayName(client);
  const status = clientStatus(client);
  const caption = clientCaption(client);
  const meeting = meetingLabel(client, today);
  const sign = clientSign(client);
  const layer = sign?.kind === 'domain' ? sign.hue : ENTITY_LOOK.therapist.hue;
  return (
    <div className="pp-leaf tc-card" style={{ '--h': layer } as CSSProperties} {...pressable(() => onOpen(client))}>
      <div className="tc-top">
        <div className="ds-avatar ds-avatar--serif ds-avatar--paper tc-avatar" style={hueStyle(clientHue(client.telegramId))}>
          {clientAvatarInitials(client)}
        </div>
        <div className="tc-who">
          <div className="tc-name-row">
            <div className="tc-name">{name}</div>
            {sign && (
              <span className="tc-sign" aria-hidden="true" data-sign={sign.kind === 'domain' ? sign.domainId : 'offline'}>
                {sign.kind === 'domain' ? <DomainMark domainId={sign.domainId} /> : <BrandMark size={28} simple bare />}
              </span>
            )}
          </div>
          <div className="tc-meta">
            <span className="tc-status">{status.label}</span>
            {caption && <span>{caption}</span>}
          </div>
        </div>
        <span className="ds-chev tc-chev" aria-hidden="true" />
      </div>
      <NextSessionLine label={meeting} />
      {client.schemaIds.length > 0 && (
        <div className="tc-chips">
          {schemaChips(client.schemaIds).map((ch) => (
            <span key={ch.id} className="tc-chip" style={{ '--h': DOMAIN_HUE[ch.domainId] } as CSSProperties}>{ch.name}</span>
          ))}
        </div>
      )}
      <div className="tc-foot">
        <span className="ds-link">Открыть →</span>
      </div>
    </div>
  );
}
