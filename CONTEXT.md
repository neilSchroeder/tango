# Tango

A browser-based logic puzzle on a 6x6 grid of suns and moons. This document is the
glossary for the puzzle domain — the vocabulary used when talking about puzzles,
how they are generated, and how they are rated. It contains no implementation
detail.

## The puzzle

**Solution Grid**:
A complete 6x6 arrangement of suns and moons satisfying both rules: exactly three
of each symbol in every row and column, and no three consecutive identical symbols
in any row or column. There are exactly 11,222 of them, falling into 852 classes
under rotation, reflection and symbol swap.
_Avoid_: Board, solved board, answer

**Given**:
A cell whose symbol is revealed to the player at the start and cannot be changed.
_Avoid_: Clue, starting piece, locked tile, hint

**Constraint Marker**:
A symbol printed on the edge between two orthogonally adjacent cells, declaring
those two cells either equal or unequal. Distinct from the two rules, which are
always in force and are never printed.
_Avoid_: Constraint, sign, hint, rule

**Rule**:
One of the two conditions every Solution Grid satisfies, in force on every puzzle
and never displayed: the balance rule and the no-three-consecutive rule. Tango has
no rule against repeated rows or columns — roughly half of all Solution Grids
contain a duplicated row.

**Puzzle Instance**:
A Solution Grid together with a chosen set of Givens and a chosen set of Constraint
Markers, having exactly one solution reachable without guessing. The unit a player
plays and the unit uniqueness is promised over.
_Avoid_: Puzzle, game, board, level

**Minimal**:
Describes a Puzzle Instance in which every Given and every Constraint Marker is
load-bearing — removing any one of them either destroys uniqueness or makes the
puzzle unsolvable without guessing.
_Avoid_: Irreducible, tight, optimal

## Solving and rating

**Technique**:
A named method of deducing a cell's symbol from the current state of a puzzle. A
Technique is sound only if every conclusion it draws follows from the two Rules and
the Constraint Markers alone.

**Tier**:
The difficulty rank of a Technique, from 1 (direct local deduction) to 4 (depth-one
contradiction). Deduction requiring more than Tier 4 is guessing, and no Puzzle
Instance may require it.
_Avoid_: Level, difficulty, rank, strategy family

**Solve Trace**:
The ordered record of a puzzle being solved one cell at a time, always by the
lowest applicable Tier. Each entry records the cell, the symbol, the Tier used, and
how many other cells were deducible at that moment. Every rating of a puzzle is
derived from its Solve Trace.
_Avoid_: Solution path, log, history

**Step**:
One entry in a Solve Trace: a single cell resolved by a single Technique.
_Avoid_: Move (which means a player's action, not a deduction)

**Band**:
The player-facing difficulty label — Easy, Medium or Hard — assigned from the
highest Tier a Puzzle Instance requires. A property measured from the Solve Trace,
never a target set by counting Givens.
_Avoid_: Difficulty level, mode, grade

**Narrowness**:
The share of Steps in a Solve Trace at which exactly one cell was deducible. High
Narrowness means the player must hunt for each next deduction rather than sweep up
many at once.

**Bottleneck**:
A Step that required a higher Tier than the Steps around it and unlocked a cascade
of easier ones. Believed, though not demonstrated, to be what makes a puzzle
memorable.
_Avoid_: Aha moment, key, crux

**Interestingness**:
The quality of a Puzzle Instance's Solve Trace as distinct from its Band — chiefly
Narrowness and Bottlenecks. A puzzle can be hard and dull, or easy and pleasing.
Every measure of it currently in use is a working hypothesis, not a validated one.

## Distribution

**Bank**:
The curated, ordered set of Puzzle Instances built offline and shipped with the
game as a static asset.
_Avoid_: Database, pool, library, catalogue

**Player**:
A single browser profile, identified by a locally stored identifier. Not a person:
the same human on a phone and a laptop is two Players, and a human who clears their
site data becomes a new Player.
_Avoid_: User, account, device

**Stream**:
The sequence of Puzzle Instances a given Player is served, being a per-Player
permutation of the Bank followed by generated puzzles once the Bank is exhausted.
A Player never sees the same Puzzle Instance twice in their Stream.
_Avoid_: Queue, playlist, rotation
