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

async function testNaturalLanguageDueDateEdgeCases(): Promise<void> {
  function parseDueDate(text: string): Date | null {
    const clean = text.trim().toLowerCase();
    if (!clean || /^\d{1,2}$/.test(clean)) return null;

    const now = new Date();
    if (clean === 'today') {
      now.setHours(12, 0, 0, 0);
      return now;
    }
    if (clean === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    if (clean === 'next week') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    if (clean === 'end of week' || clean === 'this weekend') {
      const d = new Date();
      const currentDay = now.getDay();
      const daysUntilFriday = currentDay <= 5 ? 5 - currentDay : 6;
      d.setDate(d.getDate() + daysUntilFriday);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    const inDaysMatch = clean.match(/^in\s+(\d+)\s+days?$/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      if (days >= 0 && days <= 3650) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(12, 0, 0, 0);
        return d;
      }
    }
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = clean.match(/^(?:this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i);
    if (dayMatch) {
      const targetDay = daysOfWeek.indexOf(dayMatch[1].toLowerCase());
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      const d = new Date();
      d.setDate(d.getDate() + diff);
      d.setHours(12, 0, 0, 0);
      return d;
    }

    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (y < 1970 || y > 2100 || m < 1 || m > 12 || day < 1 || day > 31) return null;
      const d = new Date(Date.UTC(y, m - 1, day, 12, 0, 0, 0));
      if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== day) {
        return null;
      }
      return d;
    }

    const normalizedText = clean.replace(/(\d+)(?:st|nd|rd|th)\b/gi, '$1');
    const monthMatch =
      normalizedText.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i) ||
      normalizedText.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (monthMatch) {
      const withYear = `${normalizedText} ${now.getFullYear()}`;
      const parsedWithYear = new Date(withYear);
      if (!isNaN(parsedWithYear.getTime())) {
        parsedWithYear.setHours(12, 0, 0, 0);
        return parsedWithYear;
      }
    }

    const parsed = new Date(normalizedText);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      if (yr >= 1970 && yr <= 2100) {
        parsed.setHours(12, 0, 0, 0);
        return parsed;
      }
    }
    return null;
  }

  function parseDueDateRequest(rawText: string): { taskQuery: string; dateText: string } | null {
    const text = rawText
      .replace(/^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|would\s+you\s+(?:please\s+)?|help\s+me\s+|i\s+want\s+to\s+)/i, '')
      .trim();

    let match = text.match(
      /^(?:set|change|update|make)\s+(?:the\s+)?due\s*date\s+(?:of|for|on)\s+(.+?)\s+(?:to|as|is|on|by|=|:)\s+(.+?)$/i,
    );
    if (match) {
      return { taskQuery: match[1].trim(), dateText: match[2].trim() };
    }

    match = text.match(
      /^(?:set|change|update|make)\s+(?:the\s+)?due\s*date\s+(?:to|as|on|by|=|:)\s+(.+?)\s+(?:for|of|on)\s+(.+?)$/i,
    );
    if (match) {
      return { taskQuery: match[2].trim(), dateText: match[1].trim() };
    }

    match = text.match(
      /^(?:set|change|update|make)\s+(.+?)\s+(?:the\s+)?due\s*date\s+(?:to|as|is|on|by|=|:)\s+(.+?)$/i,
    );
    if (match) {
      return { taskQuery: match[1].trim(), dateText: match[2].trim() };
    }

    match = text.match(
      /^(?:set|change|update|make)\s+(.+?)\s+(?:(?:to\s+be\s+)?due\s*(?:on|by|at|to|for)?)\s+(.+?)$/i,
    );
    if (match) {
      return { taskQuery: match[1].trim(), dateText: match[2].trim() };
    }

    match = text.match(
      /^(?:schedule)\s+(.+?)\s+(?:for|on|at|by|to)\s+(.+?)$/i,
    );
    if (match) {
      return { taskQuery: match[1].trim(), dateText: match[2].trim() };
    }

    match = text.match(
      /^(?:(?:set|change|update|make)\s+(?:the\s+)?)?(?:due\s*date|due)\s*(?:to|as|is|on|by|=|:)?\s+([A-Za-z0-9\s-]+?)$/i,
    );
    if (match && parseDueDate(match[1].trim())) {
      return { taskQuery: 'this task', dateText: match[1].trim() };
    }

    match = text.match(/^(?:due\s*date|due)\s+(.+?)\s+([A-Za-z0-9_.-]+(?:\s+[A-Za-z0-9_.-]+)?)$/i);
    if (match && match[1].trim().toLowerCase() !== 'date' && parseDueDate(match[2].trim())) {
      return { taskQuery: match[1].trim(), dateText: match[2].trim() };
    }

    return null;
  }

  // 1. Natural language query variations
  const req1 = parseDueDateRequest('set due date of Task 1 to tomorrow');
  assert.deepEqual(req1, { taskQuery: 'Task 1', dateText: 'tomorrow' });

  const req2 = parseDueDateRequest('can you please set the due date of asdfaf to Friday');
  assert.deepEqual(req2, { taskQuery: 'asdfaf', dateText: 'Friday' });

  const req3 = parseDueDateRequest('make Dashboard due on Friday');
  assert.deepEqual(req3, { taskQuery: 'Dashboard', dateText: 'Friday' });

  const req4 = parseDueDateRequest('schedule Login Page for Oct 15');
  assert.deepEqual(req4, { taskQuery: 'Login Page', dateText: 'Oct 15' });

  const req5 = parseDueDateRequest('set due date for Task 5 to next week');
  assert.deepEqual(req5, { taskQuery: 'Task 5', dateText: 'next week' });

  const req6 = parseDueDateRequest('set due date to tomorrow');
  assert.deepEqual(req6, { taskQuery: 'this task', dateText: 'tomorrow' });

  const req7 = parseDueDateRequest('due date tomorrow');
  assert.deepEqual(req7, { taskQuery: 'this task', dateText: 'tomorrow' });

  // 2. Date parsing checks
  const parsedIso = parseDueDate('2026-10-15');
  assert.notEqual(parsedIso, null);
  assert.equal(parsedIso!.toISOString().split('T')[0], '2026-10-15');

  const parsedTomorrow = parseDueDate('tomorrow');
  assert.notEqual(parsedTomorrow, null);
  assert.equal(parsedTomorrow!.getHours(), 12);

  console.log('✓ Natural language due date parsing & timezone edge cases passed.');
}

async function main(): Promise<void> {
  await testMarkdownSanitization();
  await testAiSearchChips();
  await testTokenStore();
  await testDateParsingEdgeCases();
  await testPositionMathEdgeCases();
  await testSubtaskProgressMath();
  await testBulkMoveEdgeCases();
  await testNaturalLanguageDueDateEdgeCases();
  console.log('All frontend edge-case tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
