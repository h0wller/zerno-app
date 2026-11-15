import { initSchema } from './schema.js';
import { initSeed, initVapid, getVapidPublicKey } from './seed.js';

export function initDatabase() {
  initSchema();
  initSeed();
  initVapid();
}

export { getVapidPublicKey };