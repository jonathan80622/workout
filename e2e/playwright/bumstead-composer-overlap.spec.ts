import { expect, test } from '@playwright/test';

const conversation = {
  id: 'composer-overlap',
  title: 'Bench press log',
  updatedAt: '2026-10-22T23:41:44.000Z',
};

const finalTranscriptLine = 'Started a new workout for it.';
const transcriptText = [
  ...Array.from({ length: 24 }, (_, index) => `Logged Bench Press set ${index + 1}: 150 lb x 10.`),
  finalTranscriptLine,
].join('\n');

const transcript = {
  id: conversation.id,
  messages: [
    {
      id: 'assistant-log',
      role: 'assistant',
      parts: [{
        type: 'text',
        // This is deliberately long enough to make the transcript scroll, as in the reported mobile view.
        text: transcriptText,
      }],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/e2e-state', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { version: 1, workouts: [], warmupCheckins: {}, scheduledSession: null } });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/chat/conversations', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { conversations: [conversation] } });
      return;
    }
    await route.fulfill({ status: 201, json: conversation });
  });
  await page.route(`**/api/chat/conversations/${conversation.id}`, (route) =>
    route.fulfill({ json: transcript }));
});

test('latest chat text is not covered by the sticky composer on mobile', async ({ page }, testInfo) => {
  // Expected to fail until the chat transcript reserves vertical space for the sticky composer.
  test.fail(true, 'Regression: the composer overlays the final transcript lines.');

  await page.goto('/?e2e=1');
  await page.getByRole('button', { name: 'Bumstead' }).click();

  const finalLine = page.getByText(finalTranscriptLine);
  const composer = page.getByPlaceholder('Ask Bumstead...');
  await expect(finalLine).toBeVisible();
  await expect(composer).toBeVisible();

  const [finalLineBox, composerBox] = await Promise.all([finalLine.boundingBox(), composer.boundingBox()]);
  await page.screenshot({ path: testInfo.outputPath('composer-overlap.png'), fullPage: false });

  expect(finalLineBox, 'the final transcript line should have a layout box').not.toBeNull();
  expect(composerBox, 'the message composer should have a layout box').not.toBeNull();
  expect(finalLineBox!.y + finalLineBox!.height,
    'the transcript must end above the sticky message composer').toBeLessThanOrEqual(composerBox!.y);
});
