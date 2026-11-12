// @vitest-environment jsdom
// Заголовок листа благодарности — разметка (две строки, вторая курсивом), glueIf листа её не склеивает. Ревью g3 r5:
// на 390 он рвался «за которые сегодня – / спасибо» — одно слово на строке; хвост «сегодня – спасибо» держится вместе
// (nowrap: после «–» браузер рвёт строку и при неразрывном пробеле), предлог «за» — со словом (glue).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { GratitudeTitle } from './GratitudeParts';
import { plainText } from '../../test-support/plainText';

afterEach(cleanup);

describe('GratitudeTitle', () => {
  it('«сегодня – спасибо» одной строкой (nowrap), слова те же', () => {
    const { container } = render(<h1><GratitudeTitle /></h1>);
    expect(container.querySelector('.sd-grat-it .sd-grat-nowrap')!.textContent).toBe('сегодня – спасибо');
    expect(container.querySelector('.sd-grat-it')!.textContent).toContain('за\u00a0которые');
    expect(plainText(container.querySelector('h1'))).toBe('Три вещи,за которые сегодня – спасибо');
    const css = readFileSync(join(__dirname, '../../styles/diary-gratitude.css'), 'utf8');
    expect(css).toMatch(/\.sd-grat-nowrap\s*\{\s*white-space:\s*nowrap;/);
  });
});
