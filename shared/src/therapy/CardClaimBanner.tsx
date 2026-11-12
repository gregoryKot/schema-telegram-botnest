import type { ReactNode } from 'react';
import { useTr } from '../utils/addressForm';
import { inviteButtonStyle } from './InviteCodeBox';
import { cardClaimKey, type CardClaim, type CardClaims } from './cardClaims';

// Плашки сверки «Это тот же человек?» над списком клиентов кабинета (S8,
// cardClaims.ts). Объяснение — прямо на плашке: терапевт видит её впервые в
// тот момент, когда надо ответить, и до ответа обязан понять, что будет по
// каждой кнопке. Пока грузится или сверок нет — ничего: у большинства
// терапевтов блок пуст, скелетон мигал бы на месте, где ничего не появится.
// Вид (b29): светлый лист без контура (тень слоем и знак «тот же человек» —
// `art`, `rowClassName` — даёт сайт), сбой — `failure` (PaperAlert сайта).
const box = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  marginBottom: 10,
} as const;
const muted = { fontSize: 12, lineHeight: 1.5, color: 'var(--text-sub)' };
const primary = {
  ...inviteButtonStyle,
  background: 'var(--accent)',
  color: 'var(--on-accent)',
} as const;

/** Вопрос плашки: имена в кавычках, пропавшее имя — словами, без «null». */
export function cardClaimQuestion(c: CardClaim): string {
  const card = c.cardName ? `карточки «${c.cardName}»` : 'офлайн-карточки';
  const account = c.clientName
    ? `аккаунт «${c.clientName}»`
    : 'аккаунт без имени';
  return `Код приглашения для ${card} использовал ${account}. Это тот же человек?`;
}

interface RowView {
  art?: ReactNode;
  rowClassName?: string;
}

function ClaimRow({
  claim,
  claims,
  art,
  rowClassName,
}: { claim: CardClaim; claims: CardClaims } & RowView) {
  const tr = useTr();
  const key = cardClaimKey(claim);
  const busy = claims.busy === key;
  return (
    <li className={rowClassName} style={{ ...box, listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {cardClaimQuestion(claim)}
        </div>
        {art}
      </div>
      <p style={{ ...muted, margin: '6px 0 10px' }}>
        Пока нет ответа, записи карточки этому аккаунту не видны. «Да» —
        задания, заметки, карта режимов и концептуализация переедут в его
        приложение, карточка останется одна. «Нет» — карточка останется офлайн,
        аккаунт — отдельным клиентом.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          style={primary}
          disabled={busy}
          onClick={() => void claims.resolve(claim, true)}
        >
          Да, объединить
        </button>
        <button
          type="button"
          style={inviteButtonStyle}
          disabled={busy}
          onClick={() => void claims.resolve(claim, false)}
        >
          Нет
        </button>
      </div>
      {claims.failed === key && (
        <div
          role="alert"
          style={{ ...muted, color: 'var(--accent-red)', marginTop: 8 }}
        >
          {tr(
            'Не удалось сохранить ответ. Попробуй ещё раз',
            'Не удалось сохранить ответ. Попробуйте ещё раз',
          )}
        </div>
      )}
    </li>
  );
}

export function CardClaimBanner({
  claims,
  className,
  failure,
  ...view
}: {
  claims: CardClaims;
  className?: string;
  failure?: (text: string) => ReactNode;
} & RowView) {
  const tr = useTr();
  const list = claims.claims;
  if (list === undefined) return null;
  if (list === null) {
    const text = tr(
      'Не удалось проверить, кто ввёл коды из офлайн-карточек. Проверь связь и открой кабинет заново',
      'Не удалось проверить, кто ввёл коды из офлайн-карточек. Проверьте связь и откройте кабинет заново',
    );
    if (failure) return <>{failure(text)}</>;
    return (
      <div
        role="alert"
        className={className}
        style={{ ...muted, color: 'var(--accent-red)' }}
      >
        {text}
      </div>
    );
  }
  if (list.length === 0) return null;
  return (
    <ul
      className={className}
      aria-label="Код из офлайн-карточки"
      style={{ margin: 0, padding: 0 }}
    >
      {list.map((c) => (
        <ClaimRow key={cardClaimKey(c)} claim={c} claims={claims} {...view} />
      ))}
    </ul>
  );
}
