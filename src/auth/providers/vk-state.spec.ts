// Инцидент 2026-10-03: VK ID вырезает из state всё, кроме [A-Za-z0-9_-], —
// подписанный state (JWT с точками) возвращался другим, и вход через VK
// падал vk_failed. Модель поведения VK сверяется с ЗАПИСАННЫМ ответом
// площадки (правило №23), а не с догадкой автора.
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import { fromVkState, toVkState } from './vk-state';

interface VkAuthorizeRecording {
  request: { state: string };
  response: { redirect_state: string };
}

const recording = JSON.parse(
  loadRecordedFixture('vk-id-authorize-state.json'),
) as VkAuthorizeRecording;

/** Что VK делает со state — проверено записью ниже. */
const vkKeeps = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');

describe('state через VK ID (записанный ответ id.vk.com/authorize)', () => {
  it('VK молча вырезает всё, кроме [A-Za-z0-9_-] — в том числе точки JWT', () => {
    const { state } = recording.request;
    expect(state).toContain('.');
    expect(recording.response.redirect_state).toBe(vkKeeps(state));
    expect(recording.response.redirect_state).not.toBe(state);
  });

  it('закодированный state VK возвращает без изменений и он раскодируется в исходный', () => {
    const encoded = toVkState(recording.request.state);
    expect(vkKeeps(encoded)).toBe(encoded);
    expect(fromVkState(vkKeeps(encoded))).toBe(recording.request.state);
  });
});
