// 0005_seed_data.sql에서 checklist_items를 파싱해 JSON으로 출력
const fs = require('fs');
const tmpDir = require('os').tmpdir();
const lines = fs.readFileSync(tmpDir + '/all_checklist_lines.txt', 'utf8').split('\n').filter(l => l.trim());
const items = [];
const re = /VALUES \('([^']+)', '([^']+)', '([^']+)', '((?:[^'\\]|\\.)*)', (NULL|'[^']*'), (true|false), (NULL|'[^']*'), (\d+)\)/;
for (const line of lines) {
  const m = line.match(re);
  if (!m) { console.error('PARSE FAIL:', line.slice(0, 100)); continue; }
  items.push({
    id: m[1], team: m[2], section: m[3],
    content: m[4].replace(/\\'/g, "'"),
    priority: m[5] === 'NULL' ? null : m[5].slice(1, -1),
    completed: m[6] === 'true',
    source: m[7] === 'NULL' ? null : m[7].slice(1, -1).replace(/\\'/g, "'"),
    sortOrder: parseInt(m[8])
  });
}
const byTeam = {};
for (const it of items) { (byTeam[it.team] ||= []).push(it); }
for (const t of ['content', 'budget', 'exchange', 'timeline']) {
  byTeam[t].sort((a, b) => a.sortOrder - b.sortOrder);
}
console.log('파싱 성공:', items.length, '개');
fs.writeFileSync(tmpDir + '/checklist_parsed.json', JSON.stringify(byTeam, null, 2));
console.log('/tmp/checklist_parsed.json 작성 완료');
