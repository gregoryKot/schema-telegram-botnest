import type { ReactNode } from 'react';
import { useTr } from '../utils/addressForm';
import { PendingInviteRow } from './PendingInviteRow';
import type { PendingInvites } from './therapyInvites';

// Блок «Ждут подключения» в кабинете терапевта (сайт и мини-апп, инцидент
// 2026-10-26). Приглашение из «Новый клиент» больше не создаёт офлайн-карточку
// рядом (после подключения их было две), поэтому до подключения клиент виден
// здесь — с именем, которое ввёл терапевт; подключится — уйдёт отсюда в
// список одной карточкой с этим именем.
//
// Пока список грузится — ничего: у большинства терапевтов блок пуст, и
// скелетон мигал бы на месте, где ничего не появится. Сбой ≠ пусто — строка
// об ошибке, а не тишина. Вид сайта (b29): `art` — знак у заголовка (Talk),
// `failure` — как показать строку сбоя (PaperAlert); без них — прежний вид.
export function PendingInvitesList({
  pending,
  className,
  art,
  failure,
}: {
  pending: PendingInvites;
  className?: string;
  art?: ReactNode;
  failure?: (text: string) => ReactNode;
}) {
  const tr = useTr();
  const { invites, revoke, revokeFailed } = pending;
  if (invites === undefined) return null;
  if (invites === null) {
    const text = tr(
      'Не удалось загрузить приглашения, которые ждут подключения. Проверь связь и открой кабинет заново',
      'Не удалось загрузить приглашения, которые ждут подключения. Проверьте связь и откройте кабинет заново',
    );
    if (failure) return <>{failure(text)}</>;
    return (
      <div
        role="alert"
        className={className}
        style={{ fontSize: 13, color: 'var(--accent-red)' }}
      >
        {text}
      </div>
    );
  }
  if (invites.length === 0) return null;
  return (
    <section className={className} aria-label="Ждут подключения">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Ждут подключения · {invites.length}
        </div>
        {art}
      </div>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--text-sub)',
          margin: '4px 0 4px',
        }}
      >
        Карточка появится в списке клиентов, когда человек подключится по ссылке
        или коду. Неделю код действует, потом приглашение исчезнет само.
      </p>
      <ul style={{ margin: 0, padding: 0 }}>
        {invites.map((i) => (
          <PendingInviteRow
            key={i.id}
            invite={i}
            onRevoke={() => void revoke(i.id)}
            revokeFailed={revokeFailed === i.id}
          />
        ))}
      </ul>
    </section>
  );
}
