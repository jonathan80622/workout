import { PrismaClient } from '@prisma/client';

const expectedTables = [
  'users',
  'profiles',
  'workouts',
  'exercise_logs',
  'workout_sets',
  'training_plans',
  'training_plan_blocks',
  'training_plan_exercises',
  'warmup_moves',
  'warmup_checkins',
  'scheduled_sessions',
  'body_weight_entries',
  'videos',
  'chat_conversations',
  'chat_messages',
  'import_batches',
  'accounts',
  'sessions',
];

const expectedConstraints = [
  'workout_sets_rpe_bounds',
  'workout_sets_nonnegative_reps_distance_time',
  'body_weight_entries_positive_values',
  'videos_positive_duration',
];

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;

  const tableNames = new Set(tables.map((row) => row.table_name));
  const missingTables = expectedTables.filter((table) => !tableNames.has(table));

  const constraints = await prisma.$queryRaw`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
  `;

  const constraintNames = new Set(constraints.map((row) => row.conname));
  const missingConstraints = expectedConstraints.filter((constraint) => !constraintNames.has(constraint));

  const currentPlanIndexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'training_plans_one_current_per_owner'
  `;

  const errors = [];
  const columns = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_logs'
  `;
  const columnNames = new Set(columns.map((row) => row.column_name));
  if (!columnNames.has('exercise_name') || columnNames.has('machine_name')) {
    errors.push('ExerciseLog column rename has not been applied.');
  }
  if (tableNames.has('machine_presets')) errors.push('Obsolete machine_presets table still exists.');
  if (missingTables.length > 0) {
    errors.push(`Missing tables: ${missingTables.join(', ')}`);
  }
  if (missingConstraints.length > 0) {
    errors.push(`Missing constraints: ${missingConstraints.join(', ')}`);
  }
  if (currentPlanIndexes.length === 0) {
    errors.push('Missing partial unique index: training_plans_one_current_per_owner');
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`Database schema verified: ${expectedTables.length} tables, ${expectedConstraints.length} custom constraints, 1 partial index.`);
} finally {
  await prisma.$disconnect();
}
