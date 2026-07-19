// @vitest-environment jsdom
// Тест unified therapist contact helper. Логика теперь в
// shared/src/utils/therapistContact.ts (правило №3, волна 2) —
// webapp/src/utils/therapistContact.ts просто реэкспортирует её. Тест лежит
// только в webapp, но защищает и копию в мини-аппе транзитивно (парный
// реэкспорт + общий источник в shared).
//
// Ключевой инвариант с 2026-07: getTherapistContact() НИКОГДА не возвращает
// личное имя — только нейтральную подпись в дательном падеже ('терапевту' /
// 'вам' / 'автору'). Если в localStorage лежит личное имя (остаток старой
// версии кэша), оно подменяется нейтральным на чтении — личные имена не
// должны светиться в CTA.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTherapistContact,
  cacheTherapistContact,
  contactCta,
} from './therapistContact';

beforeEach(() => {
  localStorage.clear();
});

describe('getTherapistContact', () => {
  it('без данных в localStorage возвращает фолбэк на автора', () => {
    const c = getTherapistContact();
    expect(c).toEqual({
      url: 'https://t.me/kotlarewski',
      bookingUrl: 'https://kotlarewski.gr/#booking',
      name: 'автору',
      isTherapist: false,
    });
  });

  it('читает сохранённый url + нейтральное имя из localStorage как есть', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const c = getTherapistContact();
    expect(c.url).toBe('tg://user?id=42');
    expect(c.bookingUrl).toBe('tg://user?id=42'); // без отдельного booking url = совпадает с url
    expect(c.name).toBe('терапевту');
    expect(c.isTherapist).toBe(false);
  });

  it('приватность: личное имя в кэше (остаток старой версии) НЕ утекает — заменяется на "терапевту" для клиента', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'Мария');
    const c = getTherapistContact();
    expect(c.name).toBe('терапевту');
    expect(c.name).not.toBe('Мария');
  });

  it('приватность: личное имя в кэше терапевта заменяется на "вам", а не остаётся личным', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'Др. Иванов');
    localStorage.setItem('therapy_is_therapist', '1');
    const c = getTherapistContact();
    expect(c.name).toBe('вам');
    expect(c.name).not.toBe('Др. Иванов');
    expect(c.isTherapist).toBe(true);
  });

  it('isTherapist=true только при therapy_is_therapist === "1"', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    expect(getTherapistContact().isTherapist).toBe(true);

    localStorage.setItem('therapy_is_therapist', 'yes'); // не '1' — не считается терапевтом
    expect(getTherapistContact().isTherapist).toBe(false);
  });

  it('если задан только url без name (частичные данные) — фолбэк на автора', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    expect(getTherapistContact().name).toBe('автору');
  });
});

describe('cacheTherapistContact', () => {
  it('роль THERAPIST: кладёт tg://user?id=<myId> и нейтральное имя "вам", ставит флаг терапевта', () => {
    cacheTherapistContact({
      role: 'THERAPIST',
      partnerId: null,
      partnerName: null,
      myId: 99,
      myName: 'Др. Иванов',
    });
    expect(localStorage.getItem('therapy_contact_url')).toBe(
      'tg://user?id=99',
    );
    // Личное имя (myName) не сохраняется — всегда нейтральная подпись.
    expect(localStorage.getItem('therapy_contact_name')).toBe('вам');
    expect(localStorage.getItem('therapy_is_therapist')).toBe('1');
  });

  it('роль THERAPIST без myId — фолбэк на AUTHOR_TG, имя всё равно "вам"', () => {
    cacheTherapistContact({
      role: 'THERAPIST',
      partnerId: null,
      partnerName: null,
      myId: null,
      myName: 'Я',
    });
    expect(localStorage.getItem('therapy_contact_url')).toBe(
      'https://t.me/kotlarewski',
    );
    expect(localStorage.getItem('therapy_contact_name')).toBe('вам');
  });

  it('роль CLIENT со связанным терапевтом: кладёт данные партнёра, имя всегда "терапевту", убирает флаг терапевта', () => {
    localStorage.setItem('therapy_is_therapist', '1'); // остаток от прошлой роли
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: 7,
      partnerName: 'Терапевт Т',
      myId: 1,
      myName: 'Клиент',
    });
    expect(localStorage.getItem('therapy_contact_url')).toBe(
      'tg://user?id=7',
    );
    // Личное имя партнёра (partnerName) не сохраняется — только нейтральная подпись.
    expect(localStorage.getItem('therapy_contact_name')).toBe('терапевту');
    expect(localStorage.getItem('therapy_is_therapist')).toBeNull();
  });

  it('роль CLIENT без partnerId (нет привязанного терапевта) — очищает кэш, getTherapistContact падает на автора', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=old');
    localStorage.setItem('therapy_contact_name', 'Старый');
    localStorage.setItem('therapy_is_therapist', '1');

    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: null,
      partnerName: null,
      myId: 1,
      myName: null,
    });

    expect(localStorage.getItem('therapy_contact_url')).toBeNull();
    expect(localStorage.getItem('therapy_contact_name')).toBeNull();
    expect(localStorage.getItem('therapy_is_therapist')).toBeNull();
    expect(getTherapistContact().name).toBe('автору');
  });
});

describe('contactCta', () => {
  it('терапевт: isSelf=true, пустой label — кнопку "написать себе" не показываем', () => {
    cacheTherapistContact({
      role: 'THERAPIST',
      partnerId: null,
      partnerName: null,
      myId: 99,
      myName: 'Др. Иванов',
    });
    const cta = contactCta();
    expect(cta.isSelf).toBe(true);
    expect(cta.label).toBe('');
    expect(cta.url).toBe('tg://user?id=99');
  });

  it('клиент со связанным терапевтом: label с нейтральной подписью "терапевту"', () => {
    cacheTherapistContact({
      role: 'CLIENT',
      partnerId: 7,
      partnerName: 'Терапевт Т',
      myId: 1,
      myName: 'Клиент',
    });
    const cta = contactCta();
    expect(cta.isSelf).toBe(false);
    expect(cta.label).toBe('Написать терапевту →');
    expect(cta.url).toBe('tg://user?id=7');
  });

  it('без привязанного терапевта: фолбэк на автора с отдельным текстом кнопки', () => {
    const cta = contactCta();
    expect(cta.isSelf).toBe(false);
    expect(cta.label).toBe('Поговорить с психологом →');
    expect(cta.url).toBe('https://t.me/kotlarewski');
  });
});
