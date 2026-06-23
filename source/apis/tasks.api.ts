import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { config } from '../config/env.config.ts';
import { salesAiHeaders } from '../helpers/headers.helper.ts';
import { TasksResponse } from '../types/tasks.type.ts';

export function getTasks(
  salesAiJwt: string,
  recordId: string,
  recordType = 'Opportunity'
): RefinedResponse<ResponseType | undefined> {
  const res = http.get(
    `${config.salesAiUrl}/api/Tasks?associatedRecordId=${recordId}&associatedRecordType=${recordType}`,
    {
      headers: salesAiHeaders(salesAiJwt),
      tags: { name: 'GetTasks' },
    }
  );

  check(res, {
    'GetTasks: status is 200': (r) => r.status === 200,
    'GetTasks: response has items array': (r) => {
      try { return Array.isArray((r.json() as unknown as TasksResponse).items); } catch { return false; }
    },
  });

  return res;
}
