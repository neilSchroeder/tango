import { PuzzleStream, type KeyValueStorage } from '../frontend/src/lib/game/bank/PuzzleStream';

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const firstPlayerStorage = new MemoryStorage();
const firstPlayer = new PuzzleStream(firstPlayerStorage, () => 'player-one');
const firstHalf = Array.from({ length: 10 }, () => firstPlayer.nextIndex('easy', 20));
if (new Set(firstHalf).size !== 10) throw new Error('A player received a duplicate puzzle');

const resumedPlayer = new PuzzleStream(firstPlayerStorage, () => 'unexpected-new-id');
const secondHalf = Array.from({ length: 10 }, () => resumedPlayer.nextIndex('easy', 20));
if (new Set([...firstHalf, ...secondHalf]).size !== 20) throw new Error('A resumed player received a duplicate puzzle');
resumedPlayer.nextIndex('medium', 20);
if (firstPlayerStorage.getItem('tango-puzzle-stream-medium') !== '1') throw new Error('Stream counters must be independent per Band');

const secondPlayer = new PuzzleStream(new MemoryStorage(), () => 'player-two');
const secondOrder = Array.from({ length: 20 }, () => secondPlayer.nextIndex('easy', 20));
if ([...firstHalf, ...secondHalf].every((index, position) => index === secondOrder[position])) throw new Error('Distinct players received the same ordering');

let exhausted = false;
try { resumedPlayer.nextIndex('easy', 20); } catch { exhausted = true; }
if (!exhausted) throw new Error('Exhausted stream did not reject a repeat');
console.log('Puzzle stream checks passed');