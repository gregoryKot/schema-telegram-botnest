import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { DomainArt } from './art/DomainArt';

/** Мотив домена по id (`rejection`…): номер для DomainArt — порядок SCHEMA_DOMAINS; неизвестный id — ничего. */
export function DomainMark({ domainId, size = 'row' }: { domainId: string; size?: 'row' | 'square' }) {
  const n = SCHEMA_DOMAINS.findIndex(d => d.id === domainId) + 1;
  if (n === 0) return null;
  return (
    <span className={`pp-row-art${size === 'square' ? ' pp-domain-art--square' : ''}`}>
      <DomainArt domain={n} size={size} />
    </span>
  );
}
