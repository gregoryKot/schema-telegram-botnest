import { describe, it, expect } from 'vitest';
import { emailLinkErrorMessage } from './emailLinkError';

const tr = (ty: string, vy: string) => (JSON.stringify({ ty, vy }));
const pick = (form: 'ty' | 'vy') => (ty: string, vy: string) => (form === 'ty' ? ty : vy);

describe('emailLinkErrorMessage', () => {
  it('занятый адрес', () => {
    expect(emailLinkErrorMessage('email_taken', pick('ty'))).toMatch(/уже привязан к другому аккаунту/);
  });

  it('ссылка открыта не в том браузере (A3) — обе формы обращения', () => {
    expect(emailLinkErrorMessage('email_link_session', pick('ty'))).toMatch(/где открыт твой аккаунт/);
    const vy = emailLinkErrorMessage('email_link_session', pick('vy'));
    expect(vy).toMatch(/где открыт ваш аккаунт/);
    expect(vy).not.toMatch(/твой|Открой /);
  });

  it('прочие и пустые коды — без сообщения', () => {
    expect(emailLinkErrorMessage(null, tr)).toBeNull();
    expect(emailLinkErrorMessage('whatever', tr)).toBeNull();
  });
});
