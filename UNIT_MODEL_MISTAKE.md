# Unit Model Mistake

I made the wrong abstraction twice by placing weight units above the actual load entry.

The first bad model was:

```ts
profile.preferredUnit -> all workouts render and edit through that unit
```

That is wrong because it makes unit a user preference, when the user does not own the unit. The machine/load entry does.

The second bad model was:

```ts
Workout.unit -> every set.weight in that workout is expressed in one workout unit
```

That is still too high. A single workout can involve machines or set rows where the load is entered in different units. The row that says `Warmup - 85 lb - 12 reps` is the place where unit meaning exists.

The correct model is:

```ts
WorkoutSet.weightUnit -> that set.weight is expressed in that set's own unit
```

Changing the unit for a set must convert only that set's stored numeric load:

```ts
85 lb -> 38.6 kg
40 kg -> 88 lb
```

It must not relabel `85 lb` as `85 kg`. It must not convert a whole workout. It must not change a user profile setting.

I made the mistake because I optimized for quick UI symmetry instead of modeling the actual record: machine, set type, load, load unit, reps. That was a product modeling error, not just a cosmetic bug.

Fixes made:

- Removed live unit selection from profile settings and the app header.
- Removed workout-level unit toggling.
- Added required `WorkoutSet.weightUnit`.
- Moved the lbs/kg toggle to the individual set row beside the weight input.
- Converted only the edited set's load value when toggling units.
- Updated volume math to convert mixed set units into a canonical pounds-based load volume.
- Made malformed old workout data with missing set units fail validation and be discarded instead of inferred.
