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

interface Props {
  client: TherapyClientSummary;
  today: string;
  onOpen: (client: TherapyClientSummary) => void;
}

// Строка в «Все клиенты» (#1674, К5): на бумаге между линиями списка .ds-rows, без белого листа. Аватар
// .ds-avatar--paper; знак — DomainArt ведущего домена или BrandMark офлайн-клиента — в строке имени; «в приложении» /
// «офлайн» — тихий текст. Встреча и чипы схем — вторая колонка на компьютере, под именем на телефоне; справа «→».
export function ClientCard({ client, today, onOpen }: Props) {
  const name = clientDisplayName(client);
  const status = clientStatus(client);
  const caption = clientCaption(client);
  const meeting = meetingLabel(client, today);
  const sign = clientSign(client);
  return (
    <div className="ds-list-row ds-list-row--hover tc-row" {...pressable(() => onOpen(client))}>
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
      <div className="tc-more">
        <NextSessionLine label={meeting} />
        {client.schemaIds.length > 0 && (
          <div className="tc-chips">
            {schemaChips(client.schemaIds).map((ch) => (
              <span key={ch.id} className="tc-chip" style={{ '--h': DOMAIN_HUE[ch.domainId] } as CSSProperties}>{ch.name}</span>
            ))}
          </div>
        )}
      </div>
      <span className="tc-go" aria-hidden="true">→</span>
    </div>
  );
}
