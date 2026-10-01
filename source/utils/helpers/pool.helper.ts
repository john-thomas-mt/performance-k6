const VU_STRIDE = 97;

export function pick_pool_value<T>(pool: T[]): T {
  const index = ((__VU - 1) * VU_STRIDE + __ITER) % pool.length;
  return pool[index];
}
