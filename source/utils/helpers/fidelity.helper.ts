import { FidelityLevel } from '../exports/types.exp.ts';

const levels: FidelityLevel[] = ['lean', 'ui', 'full'];

export function fidelity_level(): FidelityLevel {
  const level = (__ENV.FIDELITY || 'lean') as FidelityLevel;
  if (!levels.includes(level)) {
    throw new Error(`Unknown FIDELITY "${level}" — valid: ${levels.join(', ')}`);
  }
  return level;
}

export function include_ui(level: FidelityLevel) {
  return level === 'ui' || level === 'full';
}

export function include_static(level: FidelityLevel) {
  return level === 'full';
}
