// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { dropUrlParam } from './dropUrlParam';

const here = () => window.location.pathname + window.location.search + window.location.hash;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('dropUrlParam', () => {
  it('убирает только названный параметр: метки визита и фрагмент остаются', () => {
    window.history.replaceState(null, '', '/?utm_source=vk&payment=ok&yclid=42#book');
    dropUrlParam('payment');
    expect(here()).toBe('/?utm_source=vk&yclid=42#book');
  });

  it('последний параметр — адрес без «?»', () => {
    window.history.replaceState(null, '', '/subscribe?token=tok1');
    dropUrlParam('token');
    expect(here()).toBe('/subscribe');
  });

  it('параметра нет — история не трогается', () => {
    window.history.replaceState({ keep: 1 }, '', '/?utm_source=vk');
    const before = window.history.length;
    dropUrlParam('payment');
    expect(here()).toBe('/?utm_source=vk');
    expect(window.history.state).toEqual({ keep: 1 });
    expect(window.history.length).toBe(before);
  });

  it('запись истории заменяется, а не добавляется; её state сохраняется', () => {
    window.history.replaceState({ idx: 3 }, '', '/?payment=fail');
    const before = window.history.length;
    dropUrlParam('payment');
    expect(window.history.length).toBe(before);
    expect(window.history.state).toEqual({ idx: 3 });
  });
});
