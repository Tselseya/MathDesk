function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function prose(text: string) {
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.trim().split('\n').filter(Boolean);
    if (!lines.length) return '';
    if (lines.every((line) => /^\d+[.)]\s/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    }
    if (lines.every((line) => /^[-*]\s/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map((line) => inline(line.trim())).join(' ')}</p>`;
  }).join('');
}

function structured(text: string) {
  const lines = text.split('\n');
  const output: string[] = [];
  let table: string[] = [];
  let practice: string[] = [];
  const flushTable = () => { if (table.length) { output.push(`<table><tbody>${table.join('')}</tbody></table>`); table = []; } };
  const flushPractice = () => { if (practice.length) { output.push(`<ol class="practice-list">${practice.join('')}</ol>`); practice = []; } };

  for (const line of lines) {
    if (line.trim() === '**Steps:**') { flushPractice(); flushTable(); output.push('<h3>Steps</h3>'); continue; }
    if (line.trim() === '**Practice Problems:**') { flushTable(); flushPractice(); output.push('<h3>Practice Problems</h3>'); continue; }
    if (line.includes('|') && line.trim() !== '---') {
      const cells = line.split('|').map((part) => part.trim()).filter(Boolean);
      if (cells.length >= 2) table.push(`<tr><td>${inline(cells[0])}</td><td>${inline(cells[1])}</td></tr>`);
      continue;
    }
    if (/^\d+\.\s/.test(line.trim())) { practice.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`); continue; }
    if (/^[-=|]{3,}\s*$/.test(line)) continue;
    const label = line.match(/^\*\*(.+?):\*\*\s*(.*)/);
    if (label) { flushTable(); flushPractice(); output.push(`<p><strong>${inline(label[1])}:</strong> ${inline(label[2])}</p>`); continue; }
    if (line.trim()) { flushTable(); flushPractice(); output.push(`<p>${inline(line)}</p>`); }
  }
  flushTable(); flushPractice();
  return output.join('');
}

export function formatAIReply(raw: string) {
  let text = raw;
  let kind = 'prose';
  if (raw.startsWith('TYPE:SOLVE\n')) { kind = 'structured'; text = raw.slice('TYPE:SOLVE\n'.length); }
  if (raw.startsWith('TYPE:EXPLAIN\n')) { kind = 'structured'; text = raw.slice('TYPE:EXPLAIN\n'.length); }
  if (raw.startsWith('TYPE:PROSE\n')) text = raw.slice('TYPE:PROSE\n'.length);
  return kind === 'structured' ? structured(text) : prose(text);
}
