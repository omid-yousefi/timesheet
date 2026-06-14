// Timezone-safe, dependency-free Jalali (Shamsi) ↔ Gregorian conversion.
//
// Why this exists:
//   The dashboard/history previously formatted dates via
//   `format(new Date("YYYY-MM-DD"), ...)` (date-fns-jalali). Parsing a bare
//   ISO date string yields **UTC midnight**, which then shifts by a day once
//   the local timezone offset is applied (e.g. 24 Khordad rendered as
//   1405/03/25 / 1405/03/23 depending on the zone). Likewise the submission
//   path relied on `react-date-object`'s `.convert()`, which is unreliable
//   outside a full browser/DOM context.
//
//   These helpers operate purely on calendar integers, so they never touch the
//   timezone and produce identical results to the backend's conversion
//   (app/services/kpi.py). All UI date math should go through this module so
//   conversions stay consistent across the whole app.

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const WEEKDAYS_PERSIAN = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

/** Gregorian (y, m[1-12], d) → Jalali (jy, jm[1-12], jd). */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const gDaysInMonthOffset = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    gDaysInMonthOffset[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali (jy, jm[1-12], jd) → Gregorian [gy, gm[1-12], gd]. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthLengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (; gm <= 12; gm++) {
    if (gd <= monthLengths[gm - 1]) break;
    gd -= monthLengths[gm - 1];
  }
  return { gy, gm, gd };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Convert a backend Gregorian date string ("YYYY-MM-DD", optionally with a time
 * part) to a Jalali display string "YYYY/MM/DD" — without going through the
 * timezone-sensitive `Date` constructor. This is the fix for the shifted dates.
 */
export function gregorianStrToJalaliStr(iso: string): string {
  if (!iso) return iso;
  const datePart = iso.split('T')[0];
  const [gy, gm, gd] = datePart.split('-').map(Number);
  if (!gy || !gm || !gd) return iso;
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/** Jalali "YYYY/MM/DD" → Gregorian "YYYY-MM-DD" for sending to the backend. */
export function jalaliStrToGregorianStr(jalali: string): string {
  const [jy, jm, jd] = jalali.split('/').map(Number);
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

/** Today's date as Jalali parts, computed from local calendar fields. */
export function todayJalaliParts(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Today's date as a Jalali string "YYYY/MM/DD". */
export function todayJalaliStr(): string {
  const { jy, jm, jd } = todayJalaliParts();
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/** Today's Gregorian date as "YYYY-MM-DD" (local, timezone-safe). */
export function todayGregorianStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Persian weekday name for a Gregorian date string ("YYYY-MM-DD"). */
export function jalaliWeekday(iso: string): string {
  const [gy, gm, gd] = iso.split('T')[0].split('-').map(Number);
  // Build a local Date from explicit parts (no UTC shift) to read the weekday.
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun … 6=Sat
  // Jalali week starts Saturday → map Sun..Sat to index into WEEKDAYS_PERSIAN.
  return WEEKDAYS_PERSIAN[(jsDay + 1) % 7];
}

/** Long, human-friendly today label: "شنبه ۲۴ خرداد ۱۴۰۵". */
export function todayJalaliLong(): string {
  const { jy, jm, jd } = todayJalaliParts();
  const weekday = jalaliWeekday(todayGregorianStr());
  return `${weekday} ${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}
