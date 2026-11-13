// @vitest-environment jsdom
// Заголовок листа благодарности — разметка (две строки, вторая курсивом), glueIf листа её не склеивает.
// Хвост «… – спасибо» держится вместе (nowrap: после «–» браузер рвёт строку и при неразрывном пробеле);
// слова зависят от дня записи: «сегодня» или «в этот день».
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { GratitudeTitle } from './GratitudeParts';
import { plainText } from '../../test-support/plainText';

afterEach(cleanup);

describe('GratitudeTitle', () => {
  it('запись за сегодня — «За что сегодня – спасибо», хвост одной строкой (nowrap)', () => {
    const { container } = render(<h1><GratitudeTitle today /></h1>);
    expect(container.querySelector('.sd-grat-it .sd-grat-nowrap')!.textContent).toBe('сегодня – спасибо');
    expect(plainText(container.querySelector('h1'))).toBe('За чтосегодня – спасибо');
    const css = readFileSync(join(__dirname, '../../styles/diary-gratitude.css'), 'utf8');
    expect(css).toMatch(/\.sd-grat-nowrap\s*\{\s*white-space:\s*nowrap;/);
  });

  it('запись за другой день — «За что в этот день – спасибо», без «сегодня»', () => {
    const { container } = render(<h1><GratitudeTitle today={false} /></h1>);
    expect(container.querySelector('.sd-grat-it .sd-grat-nowrap')!.textContent).toBe('день – спасибо');
    expect(plainText(container.querySelector('h1'))).toBe('За чтов этот день – спасибо');
  });
});
