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

async function main(): Promise<void> {
  await testMarkdownSanitization();
  await testAiSearchChips();
  await testTokenStore();
  console.log('All frontend edge-case tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
