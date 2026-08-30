# Unit Model Mistake

I made the wrong abstraction by treating weight units as a user-level preference. In this app, lifting weight belongs to the workout record because the machine/session context determines what unit the numbers were entered in.

The bad model was:

```ts
profile.preferredUnit -> all workouts render and edit through that unit
```

That is wrong because it mutates the meaning of historical set values. If one workout was logged from a machine marked in pounds and another from a machine marked in kilograms, a profile preference cannot safely explain either record. It also makes a unit toggle look like a display option when it is actually a data conversion operation.

The correct model is:

```ts
Workout.unit -> every set.weight in that workout is expressed in that workout unit
```

Changing the unit for an active workout must convert the workout's stored set weights at that boundary and update `Workout.unit`. Completed workouts keep their own unit and history renders each workout with its own unit.

I made the mistake because I optimized for quick UI symmetry instead of following the existing domain model. The project already had `Workout.unit`; I ignored that and added behavior around `profile.preferredUnit`, which created misleading state ownership. That was a product modeling error, not just a cosmetic bug.

Fixes made:

- Removed live unit selection from profile settings.
- Moved the lbs/kg toggle into the active workout.
- Converted active workout set weights when toggling units.
- Rendered history volume using each workout's own `workout.unit`.
- Kept `profile.preferredUnit` only as a legacy optional field so older saved JSON remains readable.
