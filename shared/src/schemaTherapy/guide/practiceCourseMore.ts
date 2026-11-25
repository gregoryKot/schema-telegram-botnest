import { sessionStructureMore } from './practiceMoreArntz';
import { therapyAimsMore } from './practiceMoreFarrell';
import { therapyAimsYoung } from './practiceCourseYoung';

/** «Подробнее» к ходу терапии с дополнениями Арнтц и Якоб (пачка 3): вынесено, чтобы practiceCourse.ts не рос. */

export const therapyAimsFull: string[] = [
  ...therapyAimsMore,
  ...therapyAimsYoung,
];

export const sessionStructureFull: string[] = [
  ...sessionStructureMore,
  'В схема-терапии с клиентом говорят открыто: вместе обсуждают и план, и эмоциональные приёмы, и сами отношения в терапии [Арнтц, 4.4].',
];
