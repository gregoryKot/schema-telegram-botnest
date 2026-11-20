import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  GUIDE_MARK_NOTE_MAX,
  GUIDE_MARK_SNAPSHOT_MAX,
} from '../../utils/text-limits';
import { ADDRESS_SHAPE, GUIDE_ADDRESS_MAX } from '../guide-mark-address';

/** Отметка «Про клиента»: повтор того же адреса правит запись, а не плодит дубль. */
export class SaveGuideMarkDto {
  @IsString()
  @MaxLength(GUIDE_ADDRESS_MAX)
  @Matches(ADDRESS_SHAPE)
  address!: string;

  // Текст раздела, как его видел терапевт: покажется, если раздел переписан.
  @IsString()
  @IsNotEmpty()
  @MaxLength(GUIDE_MARK_SNAPSHOT_MAX)
  snapshot!: string;

  @IsOptional()
  @IsString()
  @MaxLength(GUIDE_MARK_NOTE_MAX)
  note?: string;
}

/** Адрес в query: кому из клиентов терапевта раздел уже отмечен. */
export class GuideMarkAddressQueryDto {
  @IsString()
  @MaxLength(GUIDE_ADDRESS_MAX)
  @Matches(ADDRESS_SHAPE)
  address!: string;
}
