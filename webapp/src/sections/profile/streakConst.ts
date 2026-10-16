export const DOW_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
export const TODAY_DOW_IDX = (new Date().getDay() + 6) % 7; // 0=пн ... 6=вс
