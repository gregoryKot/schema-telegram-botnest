import { describe, expect, it } from 'vitest';
import { nodeArticleKey } from './DiagramMarkCount';
import type { DiagramNode } from './diagramTypes';

const node = (extra: Partial<DiagramNode>): DiagramNode => ({
  id: 'n',
  kind: 'mode',
  shape: 'ellipse',
  section: 'modes',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  label: '',
  color: '',
  ...extra,
});

describe('nodeArticleKey — узел холста ↔ статья отметок «Про клиента»', () => {
  it('режим и схема — ключ вида статьи; опыт, потребность и заготовка — без счётчика', () => {
    expect(
      nodeArticleKey(node({ kind: 'mode', modeId: 'vulnerable_child' })),
    ).toBe('mode:vulnerable_child');
    expect(
      nodeArticleKey(node({ kind: 'schema', schemaId: 'subjugation' })),
    ).toBe('schema:subjugation');
    expect(
      nodeArticleKey(node({ kind: 'origin', schemaId: 'subjugation' })),
    ).toBeNull();
    expect(
      nodeArticleKey(node({ kind: 'need', needId: 'attachment' })),
    ).toBeNull();
  });
});
