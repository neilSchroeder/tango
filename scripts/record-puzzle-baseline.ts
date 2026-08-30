import { writeFileSync } from 'node:fs';
import { analyzePuzzle } from '../frontend/src/lib/game/analysis/PuzzleMetrics';
import { PuzzleGenerator } from '../frontend/src/lib/game/generators/PuzzleGenerator';
import { PUZZLE_CONFIGS } from '../frontend/src/lib/game/types';

const SAMPLE_SIZE = 20;
const RANDOM_SEED = 0xdecafbad;
const originalRandom = Math.random;
const originalConsoleLog = console.log;
let randomState = RANDOM_SEED;
Math.random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x1_0000_0000;
};
console.log = () => undefined;

const generator = new PuzzleGenerator();
const baseline = Object.fromEntries(Object.entries(PUZZLE_CONFIGS).map(([band, config]) => {
  const metrics = Array.from({ length: SAMPLE_SIZE }, () => analyzePuzzle(generator.generatePuzzle(config)));
  return [band, {
    sampleSize: SAMPLE_SIZE,
    randomSeed: RANDOM_SEED,
    metrics: metrics.map((metric) => ({
      givenCount: metric.givenCount,
      constraintCount: metric.constraintCount,
      highestTier: metric.trace.highestTier,
      solved: metric.trace.solved,
      narrowness: metric.narrowness,
      bottleneckCount: metric.bottleneckCount,
      unique: metric.unique,
      minimal: metric.minimal
    }))
  }];
}));

Math.random = originalRandom;
console.log = originalConsoleLog;
writeFileSync('puzzle-baseline.json', `${JSON.stringify(baseline, null, 2)}\n`);