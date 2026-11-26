import { healthyAdultMore as base } from './healthyMore';
import { healthyAdultHeathMore } from './healthyAdultHeathMore';

export { healthyAdultBetween } from './healthyMore';

/** «Подробнее» к healthy_adult со сострадательным умом по Хис (гл. 17): вынесено, чтобы healthyAdult.ts не рос. */
export const healthyAdultMore: string[] = [...base, ...healthyAdultHeathMore];
