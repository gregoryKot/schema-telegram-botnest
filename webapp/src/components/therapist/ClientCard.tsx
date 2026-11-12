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

// Карточка в «Все клиенты» (b29): светлый лист с тенью слоем бумаги ведущего домена (без домена —
// небо терапевта), знак — DomainArt ведущего домена (как у клиента в «Моих паттернах»), у офлайн-клиента
// — знак продукта; радужной полосы доменов больше нет. Имя переносится на вторую строку. Схемы — чипы
// бумаги своего домена. Встреча — NextSessionLine, как в шапке карточки. На телефоне вместо футера
// «Открыть →» — шеврон в строке имени (компактный список).
export function ClientCard({ client, today, onOpen }: Props) {
  const name = clientDisplayName(client);
  const status = clientStatus(client);
  const caption = clientCaption(client);
  const meeting = meetingLabel(client, today);
  const sign = clientSign(client);
  const layer = sign?.kind === 'domain' ? sign.hue : ENTITY_LOOK.therapist.hue;
  return (
    <div className="tc-card" style={{ '--h': layer } as CSSProperties} {...pressable(() => onOpen(client))}>
      <div className="tc-top">
        <div className="ds-avatar ds-avatar--serif tc-avatar" style={hueStyle(clientHue(client.telegramId))}>
          {clientAvatarInitials(client)}
        </div>
        <div className="tc-who">
          <div className="tc-name">{name}</div>
          <div className="tc-meta">
            <span className={status.inBot ? 'ds-badge ds-badge--ok' : 'ds-badge'}>{status.label}</span>
            {caption && <span>{caption}</span>}
          </div>
        </div>
        {sign && (
          <span className="tc-sign" aria-hidden="true" data-sign={sign.kind === 'domain' ? sign.domainId : 'offline'}>
            {sign.kind === 'domain' ? <DomainMark domainId={sign.domainId} /> : <BrandMark size={28} simple />}
          </span>
        )}
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
