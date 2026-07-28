const VU_STRIDE = 97;

export function pick_pool_value(pool: string[]): string {
  const index = ((__VU - 1) * VU_STRIDE + __ITER) % pool.length;
  return pool[index];
}
