import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/app/features/docs/markdown';
import { chipsFromFilters } from '../src/app/shared/lib/ai-search-chips';
import { TokenStore } from '../src/app/core/api/token.store';

async function testMarkdownSanitization(): Promise<void> {
  // Vector 1: Script tag injection
  const scriptInput = '<script>alert("xss")</script>';
  const scriptOutput = renderMarkdown(scriptInput);
  assert.ok(!scriptOutput.includes('<script>'), 'Must escape <script>');
  assert.ok(scriptOutput.includes('&lt;script&gt;'), 'Must encode <script>');

  // Vector 2: Img onerror event injection
  const imgInput = '<img src="x" onerror="evil()">';
  const imgOutput = renderMarkdown(imgInput);
  assert.ok(!imgOutput.includes('<img'), 'Must escape <img');
  assert.ok(imgOutput.includes('&lt;img'), 'Must encode <img');

  // Vector 3: Svg onload injection
  const svgInput = '<svg onload=alert(1)>';
  const svgOutput = renderMarkdown(svgInput);
  assert.ok(!svgOutput.includes('<svg'), 'Must escape <svg');

  // Vector 4: Quotes and entities
  const entityInput = 'foo & "bar" \'baz\'';
  const entityOutput = renderMarkdown(entityInput);
  assert.ok(entityOutput.includes('&amp;'));
  assert.ok(entityOutput.includes('&quot;'));
  assert.ok(entityOutput.includes('&#39;'));

  // Vector 5: Markdown formatting (headings, code blocks, lists, bold)
  const mdInput = `# Heading 1\n## Heading 2\n- Item A\n- Item B\n\`\`\`ts\nconst x = 1;\n\`\`\`\n**bold** and *italic* and \`code\``;
  const mdOutput = renderMarkdown(mdInput);
  assert.ok(mdOutput.includes('<h1>Heading 1</h1>'));
  assert.ok(mdOutput.includes('<h2>Heading 2</h2>'));
  assert.ok(mdOutput.includes('<ul><li>Item A</li><li>Item B</li></ul>'));
  assert.ok(mdOutput.includes('<pre><code>const x = 1;\n</code></pre>'));
  assert.ok(mdOutput.includes('<strong>bold</strong>'));
  assert.ok(mdOutput.includes('<em>italic</em>'));
  assert.ok(mdOutput.includes('<code>code</code>'));

  console.log('✓ Markdown sanitization & rendering edge cases passed.');
}

async function testAiSearchChips(): Promise<void> {
  // Empty filters
  const emptyChips = chipsFromFilters({});
  assert.equal(emptyChips.length, 0);

  // Status and priority chips
  const filteredChips = chipsFromFilters({
    status: ['in_progress'],
    priority: ['urgent'],
    assigneeName: 'Alice',
    text: 'auth fix',
  });
  assert.ok(filteredChips.length >= 3);
  assert.ok(filteredChips.some((c) => c.label.includes('in progress')));
  assert.ok(filteredChips.some((c) => c.label.includes('urgent')));

  console.log('✓ AI search chips edge cases passed.');
}

async function testTokenStore(): Promise<void> {
  const store = new TokenStore();
  store.clear();
  assert.equal(store.get(), null);

  store.setToken('test-token-jwt-123');
  assert.equal(store.get(), 'test-token-jwt-123');
  assert.equal(store.token(), 'test-token-jwt-123');

  store.clear();
  assert.equal(store.get(), null);
  assert.equal(store.token(), null);

  console.log('✓ Token store resilience edge cases passed.');
}

function verifyLeapDate(dateStr: string): boolean {
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return false;
  const y = parseInt(isoMatch[1], 10);
  const m = parseInt(isoMatch[2], 10);
  const day = parseInt(isoMatch[3], 10);
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
}

async function testDateParsingEdgeCases(): Promise<void> {
  // Valid leap year day
  assert.equal(verifyLeapDate('2028-02-29'), true, '2028 is a leap year');
  assert.equal(verifyLeapDate('2024-02-29'), true, '2024 is a leap year');
  assert.equal(verifyLeapDate('2000-02-29'), true, '2000 is a century leap year');

  // Invalid leap days
  assert.equal(verifyLeapDate('2026-02-29'), false, '2026 is not a leap year');
  assert.equal(verifyLeapDate('2025-02-29'), false, '2025 is not a leap year');
  assert.equal(verifyLeapDate('2028-02-30'), false, 'February never has 30 days');

  // Invalid calendar dates
  assert.equal(verifyLeapDate('2026-04-31'), false, 'April has 30 days');
  assert.equal(verifyLeapDate('2026-06-31'), false, 'June has 30 days');
  assert.equal(verifyLeapDate('2026-11-31'), false, 'November has 30 days');
  assert.equal(verifyLeapDate('2026-13-01'), false, 'Month 13 is invalid');
  assert.equal(verifyLeapDate('2026-00-10'), false, 'Month 0 is invalid');
  assert.equal(verifyLeapDate('1960-01-01'), false, 'Year < 1970 is out of bounds');
  assert.equal(verifyLeapDate('2150-01-01'), false, 'Year > 2100 is out of bounds');

  console.log('✓ Date boundary & leap-year edge cases passed.');
}

function calculatePosition(
  prevTask: { position: number } | undefined,
  nextTask: { position: number } | undefined,
): number {
  if (prevTask && nextTask) {
    if (prevTask.position >= nextTask.position) {
      return prevTask.position + 1;
    }
    return (prevTask.position + nextTask.position) / 2;
  }
  if (prevTask) return prevTask.position + 1024;
  if (nextTask) return nextTask.position > 0 ? nextTask.position / 2 : nextTask.position - 1024;
  return 1024;
}

async function testPositionMathEdgeCases(): Promise<void> {
  // Empty column
  assert.equal(calculatePosition(undefined, undefined), 1024);

  // Appending at end of list
  assert.equal(calculatePosition({ position: 2048 }, undefined), 3072);

  // Prepending to top of list
  assert.equal(calculatePosition(undefined, { position: 1024 }), 512);

  // Inserting between two tasks
  assert.equal(calculatePosition({ position: 1000 }, { position: 2000 }), 1500);

  // Corrupted or duplicate position tie-break
  assert.equal(calculatePosition({ position: 1000 }, { position: 1000 }), 1001);
  assert.equal(calculatePosition({ position: 1500 }, { position: 1200 }), 1501);

  console.log('✓ Drag & drop fractional position calculation edge cases passed.');
}

function computeSubtaskProgress(completed: number, total: number): number {
  return Math.round((completed / Math.max(total, 1)) * 100);
}

async function testSubtaskProgressMath(): Promise<void> {
  // Zero subtasks -> safe 0% (no NaN / division-by-zero)
  assert.equal(computeSubtaskProgress(0, 0), 0);

  // Normal progression
  assert.equal(computeSubtaskProgress(1, 3), 33);
  assert.equal(computeSubtaskProgress(2, 3), 67);
  assert.equal(computeSubtaskProgress(3, 3), 100);

  console.log('✓ Subtask progress division-by-zero protection passed.');
}

async function testBulkMoveEdgeCases(): Promise<void> {
  function statusFromText(value: string): string | null {
    const normalized = value.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized === 'todo' || normalized === 'open' || normalized === 'reopen') return 'todo';
    if (normalized === 'inprogress' || normalized === 'progress' || normalized === 'doing' || normalized === 'start' || normalized === 'started') return 'in_progress';
    if (normalized === 'done' || normalized === 'complete' || normalized === 'completed' || normalized === 'finished') return 'done';
    return null;
  }

  function parseBulkMove(text: string): { sourceStatus?: string; targetStatus: string } | null {
    const clean = text.trim();
    const shorthandMatch = clean.match(
      /^(?:please\s+)?(start|complete|finish|reopen)\s+(?:all\s+)?(?:the\s+)?(?:(to\s*-?\s*do|todo|in\s*-?\s*progress|progress|done|completed?)\s+)?(?:tasks?|items?|to-?dos?|everything)?\s*$/i,
    );
    if (shorthandMatch) {
      const verb = shorthandMatch[1].toLowerCase();
      const targetStatus = verb === 'start' ? 'in_progress' : verb === 'reopen' ? 'todo' : 'done';
      const sourceRaw = shorthandMatch[2];
      const sourceStatus = sourceRaw ? statusFromText(sourceRaw) : undefined;
      return { sourceStatus: sourceStatus ?? undefined, targetStatus };
    }

    const hasBulkWord =
      /\b(?:all|every|everything)\b/i.test(clean) ||
      (/\b(?:tasks|items|to-?dos)\b/i.test(clean) &&
        /\b(?:to\s*-?\s*do|todo|in\s*-?\s*progress|progress|done)\b/i.test(clean));
    if (!hasBulkWord) return null;

    const hasMoveVerb = /\b(?:move|mark|set|change|put|transfer|shift|transition|turn)\b/i.test(clean);
    if (!hasMoveVerb) return null;

    const targetMatch = clean.match(
      /(?:(?:to|into|as|unto)\s+(?:(?:the\s+)?column\s+)?|(?:(?:to|into|as|unto)\s+)?)(to\s*-?\s*do|todo|in\s*-?\s*progress|progress|doing|done|complete(?:d)?)\s*(?:column|status)?\s*$/i,
    );
    if (!targetMatch) return null;

    const targetStatus = statusFromText(targetMatch[1]);
    if (!targetStatus) return null;

    const beforeTarget = clean.slice(0, targetMatch.index).trim();
    let sourceStatus: string | undefined = undefined;

    const sourceFromIn = beforeTarget.match(
      /\b(?:from|in|inside|under)\s+(?:the\s+)?(to\s*-?\s*do|todo|in\s*-?\s*progress|progress|doing|done|complete(?:d)?)\b/i,
    );
    if (sourceFromIn) {
      sourceStatus = statusFromText(sourceFromIn[1]) ?? undefined;
    } else {
      const sourceInline =
        beforeTarget.match(
          /\b(?:all|every|everything)\s+(?:of\s+)?(?:the\s+)?(to\s*-?\s*do|todo|in\s*-?\s*progress|progress|doing|done|complete(?:d)?)\b/i,
        ) ||
        beforeTarget.match(
          /\b(to\s*-?\s*do|todo|in\s*-?\s*progress|progress|doing|done|complete(?:d)?)\s+(?:tasks?|items?|to-?dos?)\b/i,
        );
      if (sourceInline) {
        sourceStatus = statusFromText(sourceInline[1]) ?? undefined;
      }
    }

    return { sourceStatus, targetStatus };
  }

  // Test exact user prompt
  const res1 = parseBulkMove('move all the todo task to in progress');
  assert.deepEqual(res1, { sourceStatus: 'todo', targetStatus: 'in_progress' });

  // Test variants
  const res2 = parseBulkMove('move all todo tasks to in progress');
  assert.deepEqual(res2, { sourceStatus: 'todo', targetStatus: 'in_progress' });

  const res3 = parseBulkMove('move all tasks from todo to in progress');
  assert.deepEqual(res3, { sourceStatus: 'todo', targetStatus: 'in_progress' });

  const res4 = parseBulkMove('move all tasks to in progress');
  assert.deepEqual(res4, { sourceStatus: undefined, targetStatus: 'in_progress' });

  const res5 = parseBulkMove('mark all done');
  assert.deepEqual(res5, { sourceStatus: undefined, targetStatus: 'done' });

  const res6 = parseBulkMove('move all in progress tasks to done');
  assert.deepEqual(res6, { sourceStatus: 'in_progress', targetStatus: 'done' });

  const res7 = parseBulkMove('complete all todo tasks');
  assert.deepEqual(res7, { sourceStatus: 'todo', targetStatus: 'done' });

  // Single task must NOT trigger bulk move
  const resSingle = parseBulkMove('move Homepage to in progress');
  assert.equal(resSingle, null);

  console.log('✓ Bulk task movement natural language parsing edge cases passed.');
}

async function main(): Promise<void> {
  await testMarkdownSanitization();
  await testAiSearchChips();
  await testTokenStore();
  await testDateParsingEdgeCases();
  await testPositionMathEdgeCases();
  await testSubtaskProgressMath();
  await testBulkMoveEdgeCases();
  console.log('All frontend edge-case tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
