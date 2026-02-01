export interface ChaosParams {
  sigma: number;
  rho: number;
  beta: number;
  startX: number;
  startY: number;
  startZ: number;
  iterations: number;
}

export interface CustomKey {
  key: Uint8Array;
  metadata: Uint8Array;
  timestamp: number;
}

export interface EncryptionResult {
  original: string;
  encrypted: string;
  timestamp: string;
  paramsHash: string;
}

export enum AppMode {
  ENCODE = 'ENCODE',
  DECODE = 'DECODE',
  VISUALIZE = 'VISUALIZE'
}
