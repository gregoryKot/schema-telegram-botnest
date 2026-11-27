import { pressable } from '../../utils/a11y';
import type { TherapyClientSummary } from '../../api';
import { NextSessionLine } from './NextSessionLine';
import { clientCaption, clientStatus, meetingLabel, schemaLine } from './rosterModel';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientSign } from './cabinetLook';
import { DomainMark } from '../DomainMark';
import { BrandMark } from '../art/BrandMark';
import { Avatar } from '../Avatar';

interface Props {
  client: TherapyClientSummary;
  today: string;
  onOpen: (client: TherapyClientSummary) => void;
  /** «выполнено с прошлой встречи: N» — тихим текстом в строке статуса; нет выполненных — нет отметки. */
  tasksMark?: string | null;
}

// Строка в «Все клиенты» (#1674, К5): на бумаге между линиями списка .ds-rows, без белого листа. Аватар
// — общий Avatar (буква в кольце); знак — DomainArt ведущего домена или BrandMark офлайн-клиента — в строке имени; «в приложении» /
// «офлайн» — тихий текст. Встреча и схемы (тихий текст через «·», К30) — вторая колонка на компьютере, под именем на телефоне; справа «→».
export function ClientCard({ client, today, onOpen, tasksMark }: Props) {
  const name = clientDisplayName(client);
  const status = clientStatus(client);
  const caption = clientCaption(client);
  const meeting = meetingLabel(client, today);
  const sign = clientSign(client);
  const schemas = schemaLine(client.schemaIds);
  return (
    <div className="ds-list-row ds-list-row--hover tc-row" {...pressable(() => onOpen(client))}>
      <Avatar initials={clientAvatarInitials(client)} className="tc-avatar" />
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
          {tasksMark && <span>{tasksMark}</span>}
        </div>
      </div>
      <div className="tc-more">
        <NextSessionLine label={meeting} />
        {schemas && <div className="tc-schemas">{schemas}</div>}
      </div>
      <span className="tc-go" aria-hidden="true">→</span>
    </div>
  );
}
