export type FidelityLevel = 'lean' | 'ui' | 'full';

export type ChromeRequest = {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
};

export type StaticRequest = {
  path: string;
};
