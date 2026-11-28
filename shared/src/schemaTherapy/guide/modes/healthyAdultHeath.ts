import { healthyAdultMore as base } from './healthyAdultRoedigerCh3';
import { healthyAdultHeathMore } from './healthyAdultHeathMore';

export { healthyAdultBetween } from './healthyMore';

/** «Подробнее» к healthy_adult со сострадательным умом по Хис (гл. 17): вынесено, чтобы healthyAdult.ts не рос. */
export const healthyAdultMore: string[] = [...base, ...healthyAdultHeathMore];
