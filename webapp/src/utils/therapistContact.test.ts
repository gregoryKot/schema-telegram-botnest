// @vitest-environment jsdom
// Тест unified therapist contact helper (therapistContact.ts — ПАРНЫЙ файл,
// побайтово совпадает с schema-miniapp/src/utils/therapistContact.ts, см.
// scripts/check-paired-files.mjs). Тест лежит только в webapp, но защищает
// и копию в мини-аппе транзитивно — парный чекер в CI роняет сборку при
// расхождении файлов.
import { describe, it, expect, beforeEach } from 'vitest';
import { getTherapistContact, cacheTherapistContact } from './therapistContact';

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

  it('читает сохранённые url+name из localStorage', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'Мария');
    const c = getTherapistContact();
    expect(c.url).toBe('tg://user?id=42');
    expect(c.bookingUrl).toBe('tg://user?id=42'); // без отдельного booking url = совпадает с url
    expect(c.name).toBe('Мария');
    expect(c.isTherapist).toBe(false);
  });

  it('isTherapist=true только при therapy_is_therapist === "1"', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'Я');
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
  it('роль THERAPIST: кладёт tg://user?id=<myId> и имя, ставит флаг терапевта', () => {
    cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: 99, myName: 'Др. Иванов' });
    expect(localStorage.getItem('therapy_contact_url')).toBe('tg://user?id=99');
    expect(localStorage.getItem('therapy_contact_name')).toBe('Др. Иванов');
    expect(localStorage.getItem('therapy_is_therapist')).toBe('1');
  });

  it('роль THERAPIST без myId — фолбэк на AUTHOR_TG', () => {
    cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: null, myName: 'Я' });
    expect(localStorage.getItem('therapy_contact_url')).toBe('https://t.me/kotlarewski');
  });

  it('роль THERAPIST без myName — фолбэк на "вам"', () => {
    cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: 5, myName: null });
    expect(localStorage.getItem('therapy_contact_name')).toBe('вам');
  });

  it('роль CLIENT со связанным терапевтом: кладёт данные партнёра, убирает флаг терапевта', () => {
    localStorage.setItem('therapy_is_therapist', '1'); // остаток от прошлой роли
    cacheTherapistContact({ role: 'CLIENT', partnerId: 7, partnerName: 'Терапевт Т', myId: 1, myName: 'Клиент' });
    expect(localStorage.getItem('therapy_contact_url')).toBe('tg://user?id=7');
    expect(localStorage.getItem('therapy_contact_name')).toBe('Терапевт Т');
    expect(localStorage.getItem('therapy_is_therapist')).toBeNull();
  });

  it('роль CLIENT без имени партнёра — фолбэк "терапевту"', () => {
    cacheTherapistContact({ role: 'CLIENT', partnerId: 7, partnerName: null, myId: 1, myName: null });
    expect(localStorage.getItem('therapy_contact_name')).toBe('терапевту');
  });

  it('роль CLIENT без partnerId (нет привязанного терапевта) — очищает кэш, getTherapistContact падает на автора', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=old');
    localStorage.setItem('therapy_contact_name', 'Старый');
    localStorage.setItem('therapy_is_therapist', '1');

    cacheTherapistContact({ role: 'CLIENT', partnerId: null, partnerName: null, myId: 1, myName: null });

    expect(localStorage.getItem('therapy_contact_url')).toBeNull();
    expect(localStorage.getItem('therapy_contact_name')).toBeNull();
    expect(localStorage.getItem('therapy_is_therapist')).toBeNull();
    expect(getTherapistContact().name).toBe('автору');
  });
});
