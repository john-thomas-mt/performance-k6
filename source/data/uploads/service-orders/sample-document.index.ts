import { ServiceOrderDocumentFixture } from '../../../utils/exports/types.exp.ts';

export const sampleDocument: ServiceOrderDocumentFixture = {
  name: 'SampleDocument.docx',
  content: open('./SampleDocument.docx', 'b'),
};
