import { Response } from 'k6/http';

export function body_text(res: Response): string {
  return typeof res.body === 'string' ? res.body : '';
}
