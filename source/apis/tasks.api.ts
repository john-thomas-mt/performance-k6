import http from 'k6/http';
import { check } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { sales_ai_headers } from '../utils/exports/helpers.exp.ts';
import { TasksResponse } from '../utils/exports/types.exp.ts';

export function get_tasks(salesAiJwt: string, recordId: string, recordType = 'Opportunity') {
  const res = http.get(`${config.salesAiUrl}/api/Tasks?associatedRecordId=${recordId}&associatedRecordType=${recordType}`, {
    headers: sales_ai_headers(salesAiJwt),
    tags: { name: 'GetTasks' },
  });

  check(res, {
    'GetTasks: status is 200': (r) => r.status === 200,
    'GetTasks: response has items array': (r) => {
      try {
        return Array.isArray((r.json() as TasksResponse).items);
      } catch {
        return false;
      }
    },
  });

  return res;
}
