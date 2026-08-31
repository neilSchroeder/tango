import { writeFileSync } from 'node:fs';
import { analyzePuzzle } from '../frontend/src/lib/game/analysis/PuzzleMetrics';
import { candidateGenerators, defaultCandidateGenerationProfile } from '../frontend/src/lib/game/generators/CandidateGenerators';

const SAMPLE_SIZE = 20;
const RANDOM_SEED = 0x1a2b3c4d;
const originalRandom = Math.random;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
let randomState = RANDOM_SEED;
Math.random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x1_0000_0000;
};
console.log = () => undefined;
console.warn = () => undefined;

const report = Object.fromEntries(candidateGenerators.map((generator) => {
  const metrics = Array.from({ length: SAMPLE_SIZE }, () => analyzePuzzle(generator.generate(defaultCandidateGenerationProfile)));
  return [generator.name, summarize(metrics)];
}));

Math.random = originalRandom;
console.log = originalConsoleLog;
console.warn = originalConsoleWarn;
writeFileSync('candidate-generator-comparison.json', `${JSON.stringify({ sampleSize: SAMPLE_SIZE, randomSeed: RANDOM_SEED, report }, null, 2)}\n`);

function summarize(metrics: ReturnType<typeof analyzePuzzle>[]) {
  return {
    unique: metrics.filter((metric) => metric.unique).length,
    solvable: metrics.filter((metric) => metric.trace.solved).length,
    minimal: metrics.filter((metric) => metric.minimal).length,
    averageGivens: average(metrics.map((metric) => metric.givenCount)),
    averageConstraints: average(metrics.map((metric) => metric.constraintCount)),
    averageNarrowness: average(metrics.map((metric) => metric.narrowness)),
    tiers: [1, 2, 3, 4].map((tier) => metrics.filter((metric) => metric.trace.highestTier === tier).length)
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}