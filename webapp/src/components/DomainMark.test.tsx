// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { DomainMark } from './DomainMark';
import { NeedArtLine } from './NeedArtLine';

describe('DomainMark', () => {
  it('рисует мотив для каждого домена из SCHEMA_DOMAINS', () => {
    for (const d of SCHEMA_DOMAINS) {
      const { container, unmount } = render(<DomainMark domainId={d.id} />);
      expect(container.querySelector('svg'), d.id).not.toBeNull();
      unmount();
    }
  });
  it('разным доменам — разные мотивы', () => {
    const html = SCHEMA_DOMAINS.map(d => {
      const { container, unmount } = render(<DomainMark domainId={d.id} />);
      const s = container.innerHTML;
      unmount();
      return s;
    });
    expect(new Set(html).size).toBe(SCHEMA_DOMAINS.length);
  });
  it('неизвестный id — пусто (группы режимов тоже идут через общий список)', () => {
    const { container } = render(<DomainMark domainId="shadow" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('NeedArtLine', () => {
  it('рисует мотив потребности; неизвестный id — без svg', () => {
    expect(render(<NeedArtLine id="play" />).container.querySelector('svg')).not.toBeNull();
    expect(render(<NeedArtLine id="zzz" />).container.querySelector('svg')).toBeNull();
  });
});
