export const config = {
  baseUrl: __ENV.BASE_URL || 'https://qe.ungerboeck.com/AutomatedUITesting/26_2',
  salesAiUrl: __ENV.SALES_AI_URL || 'https://momentus-sales-ai-dev.ungerboeck.net',
  tenantId: __ENV.TENANT_ID || 'QESampleAutomatedUITesting262',
  appVersion: __ENV.APP_VERSION || '26.2.9634.31065',
  // Marker description for the seeded service-order pool — shared by the seed script
  // (source/seeds/service-orders.seed.ts) and the consuming test for discovery-by-search.
  seedEventDesc: __ENV.SEED_EVENT_DESC || 'PerfSeed Service Order Pool',
};
