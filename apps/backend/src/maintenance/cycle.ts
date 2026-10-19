export const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
};

/** Start of the current 3-year certification cycle: each re-certification restarts it. */
export const cycleStart = (certification: Date, now = new Date()) => {
  let start = new Date(certification);
  while (addMonths(start, 36) <= now) start = addMonths(start, 36);
  return start;
};
