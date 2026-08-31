export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PLAYER_ID_KEY = 'tango-player-id';
const STREAM_COUNTER_PREFIX = 'tango-puzzle-stream-';

export class PuzzleStream {
  private readonly playerId: string;
  private readonly orderCache = new Map<string, number[]>();

  constructor(private readonly storage: KeyValueStorage, createPlayerId: () => string = () => crypto.randomUUID()) {
    this.playerId = storage.getItem(PLAYER_ID_KEY) ?? createPlayerId();
    storage.setItem(PLAYER_ID_KEY, this.playerId);
  }

  nextIndex(difficulty: string, entryCount: number): number {
    const order = this.orderFor(difficulty, entryCount);
    const counterKey = `${STREAM_COUNTER_PREFIX}${difficulty}`;
    const counter = Number(this.storage.getItem(counterKey) ?? '0');
    if (!Number.isInteger(counter) || counter < 0) {
      throw new Error('Puzzle stream counter is invalid');
    }
    if (counter >= order.length) {
      throw new Error(`Puzzle bank exhausted for ${difficulty}`);
    }
    this.storage.setItem(counterKey, String(counter + 1));
    return order[counter];
  }

  private orderFor(difficulty: string, entryCount: number): number[] {
    const cacheKey = `${difficulty}:${entryCount}`;
    const cached = this.orderCache.get(cacheKey);
    if (cached) return cached;

    const random = seededRandom(hash(`${this.playerId}:${difficulty}`));
    const order = Array.from({ length: entryCount }, (_, index) => index);
    for (let index = order.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    this.orderCache.set(cacheKey, order);
    return order;
  }
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}