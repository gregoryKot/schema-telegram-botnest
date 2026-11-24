import { useEffect } from 'react';
import { parseAddress } from '../../../../shared/src/schemaTherapy/guide/address/addressFormat';
import { findReferenceItem, type GuideSheetTarget } from './guideSheetRoute';
import type { Reference, ReferenceItem } from './guideReferenceModel';

/** Лист по адресу раздела (`kind:id/path`) — один раз при показе; адрес не находит лист — ничего. */
export function useAddressSheet(ref: Reference, open: (item: ReferenceItem) => void, address?: string): void {
  useEffect(() => {
    const p = address ? parseAddress(address) : null;
    const item = p && findReferenceItem(ref, { kind: p.kind, id: p.articleId } as GuideSheetTarget);
    if (item) open(item);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- один раз при открытии листа
}
