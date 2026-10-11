import { PrismaClient } from '@prisma/client';

// Links a signed-in Google account to an existing data owner, so that account sees that owner's data.
// The account must have signed in at least once. Dry run by default; pass --apply to write.
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const email = argValue('--email');
const ownerAuthSubject = argValue('--owner');

if (!email) fail('Missing --email <google account email>.');
if (!ownerAuthSubject) fail('Missing --owner <users.auth_subject>.');
if (!process.env.DATABASE_URL) fail('DATABASE_URL is required.');

const prisma = new PrismaClient();
try {
  const accounts = await prisma.account.findMany({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (accounts.length === 0) fail(`No account has signed in with ${email}. Sign in on the site first.`);
  if (accounts.length > 1) fail(`More than one account uses ${email}; link by hand.`);
  const [account] = accounts;

  const owner = await prisma.user.findUnique({
    where: { authSubject: ownerAuthSubject },
    select: { id: true, _count: { select: { workouts: true } } },
  });
  if (!owner) fail(`No data owner has auth_subject ${ownerAuthSubject}.`);
  if (account.ownerUserId && account.ownerUserId !== owner.id) fail(`${email} is already linked to a different owner.`);

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', email, accountId: account.id, ownerAuthSubject, ownerId: owner.id, ownerWorkouts: owner._count.workouts, alreadyLinked: account.ownerUserId === owner.id }, null, 2));
  if (!apply) {
    console.log('\nDry run complete. Run again with --apply to link.');
  } else if (account.ownerUserId !== owner.id) {
    await prisma.account.update({ where: { id: account.id }, data: { ownerUserId: owner.id } });
    console.log(`\nLinked ${email} to ${ownerAuthSubject}.`);
  }
} finally {
  await prisma.$disconnect();
}

function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? '' : (args[index + 1] || '').trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
