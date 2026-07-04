import http, { FileData, RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { salesAiHeaders } from '../utils/exports/helpers.exp.ts';
import { UploadResult } from '../utils/exports/types.exp.ts';

export function uploadOpportunityFile(salesAiJwt: string, fileContent: string, filename: string): UploadResult | null {
  const payload: Record<string, string | FileData> = {
    'traceId': crypto.randomUUID(),
    'text': 'Process this text as if it may have Event Opportunity information!',
    'files': http.file(fileContent, filename, 'text/plain'),
    'metadata.source': 'file-upload',
    'metadata.submittedAt': new Date().toISOString(),
    'metadata.sessionId': crypto.randomUUID(),
    'metadata.referrer': `${config.salesAiUrl}/dashboard`,
  };

  const res: RefinedResponse<ResponseType | undefined> = http.post(`${config.salesAiUrl}/api/opportunities/file-upload`, payload, {
    headers: salesAiHeaders(salesAiJwt),
    tags: { name: 'FileUpload' },
  });

  const ok = check(res, {
    'FileUpload: status is 202': (r) => r.status === 202,
    'FileUpload: response has traceId': (r) => {
      try {
        return Boolean((r.json() as unknown as UploadResult).traceId);
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] uploadOpportunityFile failed — HTTP ${res.status}: ${res.body}`);
    return null;
  }

  return res.json() as unknown as UploadResult;
}
