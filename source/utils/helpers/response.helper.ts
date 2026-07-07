import { Response } from 'k6/http';

export function bodyText(res: Response): string {
  return typeof res.body === 'string' ? res.body : '';
}
