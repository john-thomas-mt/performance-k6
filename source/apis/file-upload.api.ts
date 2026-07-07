import http, { FileData } from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { sales_ai_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { UploadResult } from '../utils/exports/types.exp.ts';

export function upload_opportunity_file(salesAiJwt: string, fileContent: string, filename: string) {
  const payload: { [field: string]: string | FileData } = {
    'traceId': crypto.randomUUID(),
    'text': 'Process this text as if it may have Event Opportunity information!',
    'files': http.file(fileContent, filename, 'text/plain'),
    'metadata.source': 'file-upload',
    'metadata.submittedAt': new Date().toISOString(),
    'metadata.sessionId': crypto.randomUUID(),
    'metadata.referrer': `${config.salesAiUrl}/dashboard`,
  };

  const res = http.post(`${config.salesAiUrl}/api/opportunities/file-upload`, payload, {
    headers: sales_ai_headers(salesAiJwt),
    tags: { name: 'FileUpload' },
  });

  const ok = check(res, {
    'FileUpload: status is 202': (r) => r.status === 202,
    'FileUpload: response has traceId': (r) => {
      try {
        return Boolean((r.json() as UploadResult).traceId);
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] upload_opportunity_file failed — HTTP ${res.status}: ${body_text(res)}`);
    fail('upload_opportunity_file did not succeed');
  }

  return res.json() as UploadResult;
}
