import { PrismaClient } from '@prisma/client';

const expectedTables = [
  'users',
  'profiles',
  'workouts',
  'exercise_logs',
  'workout_sets',
  'machine_presets',
  'training_plans',
  'training_plan_blocks',
  'training_plan_exercises',
  'warmup_moves',
  'warmup_checkins',
  'scheduled_sessions',
  'body_weight_entries',
  'videos',
  'trainer_feedback',
  'chat_conversations',
  'chat_messages',
  'import_batches',
];

const expectedConstraints = [
  'workout_sets_rpe_bounds',
  'workout_sets_nonnegative_values',
  'body_weight_entries_positive_values',
  'videos_positive_duration',
  'trainer_feedback_exercise_matches_workout',
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
