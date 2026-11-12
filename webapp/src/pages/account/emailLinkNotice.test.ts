import { describe, it, expect } from 'vitest';
import { emailLinkNotice } from './emailLinkNotice';

const tr = (ty: string, vy: string) => (JSON.stringify({ ty, vy }));
const pick = (form: 'ty' | 'vy') => (ty: string, vy: string) => (form === 'ty' ? ty : vy);

describe('emailLinkNotice — что сказать у строки Email', () => {
  it('?linked=email — успех статусом', () => {
    expect(emailLinkNotice('email', null, pick('ty'))).toEqual({ kind: 'ok', text: 'Email успешно привязан' });
  });

  it('ошибка важнее успеха и несёт текст причины в форме читателя', () => {
    const n = emailLinkNotice('email', 'email_taken', pick('vy'));
    expect(n?.kind).toBe('error');
    expect(n?.text).toMatch(/Войдите по нему/);
  });

  it('ничего не пришло или чужой код — ничего не показываем', () => {
    expect(emailLinkNotice(null, null, tr)).toBeNull();
    expect(emailLinkNotice('google', 'whatever', tr)).toBeNull();
  });
});
