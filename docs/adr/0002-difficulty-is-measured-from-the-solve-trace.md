# Difficulty is measured from the Solve Trace

Difficulty used to be a dial on the generator: each Band declared a range of Givens
and a constraint probability, and the generator removed cells until it hit the
count. Clue count turns out to be a poor proxy — a puzzle with few Givens and a
dense web of Constraint Markers can be easier than one with many — and the two dials
produced five Bands of which two were byte-for-byte identical. So difficulty is now
an output, not an input: the logical solver emits a Solve Trace, and a puzzle's Band
is the highest Tier that Trace required.

## Consequences

The solver resolves one cell at a time by the lowest applicable Tier, rather than
sweeping up every available deduction at once. This is slower and is the point: you
cannot count how many cells were deducible at a Step if each Step consumes all of
them, so batching makes Narrowness and Bottlenecks unmeasurable.

Generation becomes generate-and-filter. Cheap generators propose many candidates and
an expensive scorer picks the winners, which is what every production Sudoku and
Takuzu generator does — targeted construction, where you build a puzzle that forces
a chosen Technique at a chosen point, is an unsolved problem with no published
algorithm. Scoring therefore happens offline when building the Bank, where compute
is free.

The scorer and the game must share one solver. A separate copy in the Bank builder
would drift, and the ratings would quietly become fiction.

Everything beyond the Band is a hypothesis. Technique-tiering is well established
in the Sudoku solver community, but Narrowness, Bottlenecks and the value of
symmetry are constructor folklore with no published validation and no human-subject
study behind them in any puzzle family. The weights are config, tuned by playing,
and expected to be wrong at first.
