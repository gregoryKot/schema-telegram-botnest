// Мини-апп: общий блок шаринга (shared/share/ShareTwoOptions) с листом и
// кнопкой этой площадки.
import {
  ShareTwoOptions as Shared,
  type ShareTwoOptionsProps,
} from '../../../shared/src/share/ShareTwoOptions';
import { SharePill } from './SharePill';
import { ShareCardSheet } from './ShareCardSheet';

export type { ShareTwoOptionsProps };
export function ShareTwoOptions(
  props: Omit<ShareTwoOptionsProps, 'Sheet' | 'Pill'>,
) {
  return <Shared {...props} Sheet={ShareCardSheet} Pill={SharePill} />;
}
