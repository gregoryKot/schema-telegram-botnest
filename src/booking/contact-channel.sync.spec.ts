// Сверка бэкендовой копии списка каналов связи со shared/src (правило №4:
// два места, обязанные совпадать, фиксируются тестом; почему копия, а не
// импорт — см. client-timezone.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONTACT_CHANNELS,
  contactChannelLabel,
  isContactChannel,
} from './contact-channel';

const shared = readFileSync(
  join(__dirname, '..', '..', 'shared', 'src', 'booking', 'contactChannel.ts'),
  'utf8',
);

describe('contact-channel: копия совпадает со shared', () => {
  it('список каналов', () => {
    const m = shared.match(/CONTACT_CHANNELS = \[([^\]]+)\] as const/);
    expect(m).not.toBeNull();
    const ids = m![1].split(',').map((x) => x.trim().replace(/'/g, ''));
    expect(ids).toEqual([...CONTACT_CHANNELS]);
  });

  it('подписи', () => {
    const m = shared.match(/const LABELS[^{]*\{([\s\S]*?)\n\};/);
    expect(m).not.toBeNull();
    const pairs = [...m![1].matchAll(/(\w+): '([^']+)'/g)];
    expect(pairs.length).toBe(CONTACT_CHANNELS.length);
    for (const [, id, label] of pairs) {
      expect(contactChannelLabel(id as 'telegram')).toBe(label);
    }
  });
});

describe('isContactChannel', () => {
  it('пропускает только известные каналы', () => {
    for (const ch of CONTACT_CHANNELS) expect(isContactChannel(ch)).toBe(true);
    for (const bad of ['sms', '', 'Telegram', null, undefined, 1, {}]) {
      expect(isContactChannel(bad)).toBe(false);
    }
  });
});
