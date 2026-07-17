export type FidelityLevel = 'lean' | 'ui' | 'full';

export type ChromeRequest = {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  removedIn?: string;
};

export type StaticRequest = {
  path: string;
};
