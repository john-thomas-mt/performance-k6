const MIN_YEARS_BACK = 2;
const MAX_YEARS_BACK = 7;
const MAX_MONTHS_SPAN = 12;

function random_int(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function format_period(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

export function fiscal_period_range(now = new Date()): { from: string; thru: string } {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const minYear = currentYear - random_int(MIN_YEARS_BACK, MAX_YEARS_BACK);

  const fromYear = random_int(minYear, currentYear);
  const fromMonth = random_int(1, fromYear === currentYear ? currentMonth : 12);

  let thruYear = fromYear;
  let thruMonth = fromMonth + random_int(0, MAX_MONTHS_SPAN);
  while (thruMonth > 12) {
    thruYear += 1;
    thruMonth -= 12;
  }
  if (thruYear * 100 + thruMonth > currentYear * 100 + currentMonth) {
    thruYear = currentYear;
    thruMonth = currentMonth;
  }

  return { from: format_period(fromYear, fromMonth), thru: format_period(thruYear, thruMonth) };
}

export function pick_account_range(accounts: string[]): { from: string; thru: string } {
  const first = random_int(0, accounts.length - 1);
  let second = random_int(0, accounts.length - 1);
  while (second === first) second = random_int(0, accounts.length - 1);

  const a = accounts[first];
  const b = accounts[second];
  return a < b ? { from: a, thru: b } : { from: b, thru: a };
}
