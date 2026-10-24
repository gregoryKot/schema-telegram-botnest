// VK ID пропускает в state только [A-Za-z0-9_-] и молча вырезает остальное
// (проверено 2026-10-03: id.vk.com/authorize вернул наш state без двух точек
// в redirect_state). Наш state — подписанный JWT `a.b.c`, без точек он не
// совпадал с кукой oauth_state, и каждый вход через VK падал vk_failed с тех
// пор, как state стал JWT (аудит C1). Поэтому к VK он уходит в base64url —
// алфавит ровно тот, что VK пропускает, — и раскодируется в колбэке.
export function toVkState(state: string): string {
  return Buffer.from(state, 'utf8').toString('base64url');
}

export function fromVkState(raw: string): string {
  return Buffer.from(raw, 'base64url').toString('utf8');
}
