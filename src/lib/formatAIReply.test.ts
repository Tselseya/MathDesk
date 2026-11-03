import { describe, expect, it } from 'vitest';
import { formatAIReply } from './formatAIReply';

describe('formatAIReply', () => {
  it('escapes markup in prose replies instead of treating it as HTML', () => {
    const output = formatAIReply('TYPE:PROSE\nTry <script>alert(1)</script> and <img src=x onerror=alert(1)>');

    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(output).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders structured solve sections with safe generated markup', () => {
    const output = formatAIReply([
      'TYPE:SOLVE',
      '**Steps:**',
      '1. Isolate the variable.',
      '2. Check the result.',
      '**Practice Problems:**',
      '1. Solve 3x = 12.',
    ].join('\n'));

    expect(output).toContain('<h3>Steps</h3>');
    expect(output).toContain('<ol class="practice-list">');
    expect(output).toContain('<li>Isolate the variable.</li>');
    expect(output).toContain('<li>Check the result.</li>');
    expect(output).toContain('<h3>Practice Problems</h3>');
  });

  it('preserves the first number when prose contains separated numbered items', () => {
    const output = formatAIReply('TYPE:PROSE\n3. First step\n\n4. Second step');

    expect(output).toContain('<ol start="3">');
    expect(output).toContain('<li>First step</li>');
    expect(output).toContain('<li>Second step</li>');
  });

  it('does not emit executable attributes from inline text', () => {
    const output = formatAIReply('TYPE:PROSE\n**Answer:** <a href="javascript:alert(1)">click</a>');

    expect(output).not.toContain('<a ');
    expect(output).not.toContain(' onclick=');
    expect(output).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;click&lt;/a&gt;');
  });
});
