import type { components } from 'schemas';

/** components['schemas'][K] 축약 헬퍼 */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];
