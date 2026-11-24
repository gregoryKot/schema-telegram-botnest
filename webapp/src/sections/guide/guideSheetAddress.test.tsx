// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAddressSheet } from './guideAddressSheet';
import type { Reference } from './guideReferenceModel';

const item = { kind: 'mode', id: 'angry', name: 'Х' };
const ref = { modes: [{ items: [item] }] } as unknown as Reference;

describe('лист справочника по адресу раздела', () => {
  it('открывает лист статьи один раз', () => {
    const open = vi.fn();
    const { rerender } = renderHook(() => useAddressSheet(ref, open, 'mode:angry/goal'));
    rerender();
    expect(open).toHaveBeenCalledExactlyOnceWith(item);
  });
  it('неизвестная статья или нет адреса — молчит', () => {
    const open = vi.fn();
    renderHook(() => useAddressSheet(ref, open, 'mode:nope/goal'));
    renderHook(() => useAddressSheet(ref, open, undefined));
    expect(open).not.toHaveBeenCalled();
  });
});
