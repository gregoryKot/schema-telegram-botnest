import { describe, it, expect } from 'vitest';
import {
  pendingInviteUrl,
  canCreateInvite,
  inviteButtonLabel,
  freshInviteUrl,
} from './pairView';

const URL = 'https://t.me/bot/diary?startapp=pair_AB12';

describe('pendingInviteUrl', () => {
  it('нет ждущего приглашения — пусто, даже если сервер прислал ссылку', () => {
    expect(pendingInviteUrl({ pendingCode: null, pendingUrl: URL })).toBe('');
  });
  it('есть код и ссылка — ссылка', () => {
    expect(pendingInviteUrl({ pendingCode: 'AB12', pendingUrl: URL })).toBe(
      URL,
    );
  });
  it('есть код, ссылки нет (старый ответ) — пусто', () => {
    expect(pendingInviteUrl({ pendingCode: 'AB12' })).toBe('');
    expect(pendingInviteUrl({ pendingCode: 'AB12', pendingUrl: null })).toBe(
      '',
    );
  });
});

describe('canCreateInvite', () => {
  it('приглашения нет — можно создать', () => {
    expect(canCreateInvite({ pendingCode: null })).toBe(true);
  });
  it('приглашение ждёт и ссылка есть — кнопку прячем, ссылка для повторной отправки', () => {
    expect(canCreateInvite({ pendingCode: 'AB12', pendingUrl: URL })).toBe(
      false,
    );
  });
  it('приглашение ждёт, а ссылки нет — кнопка остаётся, иначе ссылку не получить', () => {
    expect(canCreateInvite({ pendingCode: 'AB12', pendingUrl: null })).toBe(
      true,
    );
  });
});

describe('inviteButtonLabel', () => {
  const base = {
    loading: false,
    createError: false,
    hasPartners: false,
    hasPending: false,
  };
  it('первое приглашение', () => {
    expect(inviteButtonLabel(base)).toBe('Пригласить друга');
  });
  it('партнёр уже подключён — «ещё друга»', () => {
    expect(inviteButtonLabel({ ...base, hasPartners: true })).toBe(
      'Пригласить ещё друга',
    );
  });
  it('ждущее приглашение — «Новая ссылка»', () => {
    expect(
      inviteButtonLabel({ ...base, hasPending: true, hasPartners: true }),
    ).toBe('Новая ссылка');
  });
  it('ошибка важнее ярлыка, загрузка важнее ошибки', () => {
    expect(inviteButtonLabel({ ...base, createError: true })).toBe(
      'Не получилось — ещё раз',
    );
    expect(
      inviteButtonLabel({ ...base, createError: true, loading: true }),
    ).toBe('...');
  });
});

describe('freshInviteUrl', () => {
  it('не дублирует ссылку, совпавшую с ждущей', () => {
    expect(freshInviteUrl(URL, URL)).toBe('');
  });
  it('новая ссылка показывается', () => {
    expect(freshInviteUrl(URL, '')).toBe(URL);
  });
  it('пустая остаётся пустой', () => {
    expect(freshInviteUrl('', URL)).toBe('');
  });
});
