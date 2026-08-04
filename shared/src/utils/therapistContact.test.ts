// @vitest-environment jsdom
// Контакт терапевта: cacheTherapistContact ПИШЕТ в localStorage,
// getTherapistContact ЧИТАЕТ — классическая связка read-after-write (правило
// CLAUDE.md): App.tsx кэширует при загрузке профиля, все компоненты читают
// отсюда. Регрессия, которую этот файл специально защищает от повтора —
// личное имя партнёра/терапевта не должно осесть в localStorage и всплыть в
// подписи кнопки («Написать Григорий» ломает падеж и светит имя).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTherapistContact,
  cacheTherapistContact,
  contactCta,
} from './therapistContact';

beforeEach(() => {
  localStorage.clear();
});

describe('getTherapistContact — без кэша', () => {
  it('фолбэк на автора, isTherapist=false', () => {
    const c = getTherapistContact();
    expect(c.isTherapist).toBe(false);
    expect(c.name).toBe('автору');
  });
});

describe('cacheTherapistContact → getTherapistContact (read-after-write)', () => {
  it('роль THERAPIST: кэш пишет tg://user?id=… и «вам», читается обратно', () => {
    cacheTherapistContact({
      role: 'THERAPIST',
      partnerId: null,
      partnerName: null,
      myId: 555,
      myName: 'Анна',
    });
    const c = getTherapistContact();
    expect(c.url).toBe('tg://user?id=555');
    expect(c.isTherapist).toBe(true);
    // Личное имя («Анна») не сохраняется — только нейтральная подпись.
    expect(c.name).toBe('вам');
  });

  it('клиент со связанным терапевтом: url на partnerId, name «терапевту»', () => {
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: 777,
      partnerName: 'Григорий',
      myId: 1,
      myName: 'Клиент',
    });
    const c = getTherapistContact();
    expect(c.url).toBe('tg://user?id=777');
    expect(c.name).toBe('терапевту');
    expect(c.isTherapist).toBe(false);
  });

  it('клиент без терапевта: кэш очищается, фолбэк на автора', () => {
    // Сначала кэшируем связь, потом — «отвязка» (partnerId=null).
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: 777,
      partnerName: 'Григорий',
      myId: 1,
      myName: 'Клиент',
    });
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: null,
      partnerName: null,
      myId: 1,
      myName: 'Клиент',
    });
    const c = getTherapistContact();
    expect(c.name).toBe('автору');
    expect(c.isTherapist).toBe(false);
  });

  it('THERAPIST без myId — фолбэк на ссылку автора вместо битого tg://user?id=undefined', () => {
    cacheTherapistContact({
      role: 'THERAPIST',
      partnerId: null,
      partnerName: null,
      myId: null,
      myName: null,
    });
    const c = getTherapistContact();
    expect(c.url).not.toContain('undefined');
  });

  it('легаси-кэш с личным именем в localStorage подменяется нейтральной подписью', () => {
    // Симулируем старую версию кэша (до правила «личные имена не сохраняем»).
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'Григорий');
    localStorage.setItem('therapy_is_therapist', '1');
    const c = getTherapistContact();
    expect(c.name).not.toBe('Григорий');
    expect(c.name).toBe('вам');
  });
});

describe('contactCta', () => {
  it('isTherapist — кнопки «написать себе» нет (isSelf=true, пустой label)', () => {
    const cta = contactCta({
      url: 'tg://user?id=1',
      bookingUrl: 'tg://user?id=1',
      name: 'вам',
      isTherapist: true,
    });
    expect(cta.isSelf).toBe(true);
    expect(cta.label).toBe('');
  });

  it('контакт по умолчанию (автор) — «Поговорить с психологом»', () => {
    const cta = contactCta({
      url: 'https://t.me/kotlarewski',
      bookingUrl: 'https://kotlarewski.gr/#booking',
      name: 'автору',
      isTherapist: false,
    });
    expect(cta.isSelf).toBe(false);
    expect(cta.label).toBe('Поговорить с психологом →');
  });

  it('свой терапевт — «Написать терапевту»', () => {
    const cta = contactCta({
      url: 'tg://user?id=777',
      bookingUrl: 'tg://user?id=777',
      name: 'терапевту',
      isTherapist: false,
    });
    expect(cta.label).toBe('Написать терапевту →');
  });

  it('без аргумента — читает текущий кэш через getTherapistContact', () => {
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: 9,
      partnerName: null,
      myId: 1,
      myName: null,
    });
    expect(contactCta().label).toBe('Написать терапевту →');
  });
});
