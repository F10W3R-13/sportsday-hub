// 체크리스트 항목 변환 스크립트 v2
// 규칙 A (기호 풀기), 규칙 C (작년 참고 분리) + 수작업 판단 반영
const fs = require('fs');
const tmpDir = require('os').tmpdir();
const byTeam = JSON.parse(fs.readFileSync(tmpDir + '/checklist_parsed.json', 'utf8'));

// 규칙 A: 문서 절 참조 (§ 기호)
const SECTION_MAP = {
  '§3-1': '지침의 성별 항목 안내',
  '§3': '지침의 게임 양식',
};

// 규칙 A: 내부 전문용어
const JARGON_MAP = {
  '주 템플릿': '주 기준(25-2)',
  '보전 한도': '동아리 예산 보전 한도',
};

function transformContent(original, existingSource, _team, _sortOrder) {
  let content = original;
  let source = existingSource;
  const changes = [];

  // 규칙 C: 작년 참고 괄호 분리 (콜론 기반: "(25-2: ...)" "(26-1: ...)")
  const refPattern = /\((2[56]-[12]):\s*([^)]+)\)/g;
  const extractedRefs = [];
  let refMatch;
  while ((refMatch = refPattern.exec(content)) !== null) {
    extractedRefs.push(refMatch[1] + ': ' + refMatch[2]);
    changes.push('작년 참고 분리');
  }
  if (extractedRefs.length > 0) {
    content = content.replace(refPattern, '').replace(/\s{2,}/g, ' ').trim();
    const refStr = extractedRefs.join(' / ');
    source = source ? source + ' / ' + refStr : refStr;
  }

  // 규칙 A: 결정 안건 기호 (D1-D7) — 괄호 안의 D번호 제거
  // "(D4, 8/16~8/25 — 보전 한도 파악 후)" → "8/16~8/25 — 보전 한도 파악 후" (의미 보존)
  content = content.replace(/\((D[1-7]),\s*/g, '(');  // (D4, → (
  content = content.replace(/\((D[1-7])\s*,\s*/g, '(');  // (D4, → (
  // 단독 (D1) 형태 제거
  for (let i = 1; i <= 7; i++) {
    const sym = 'D' + i;
    if (content.includes('(' + sym + ')')) {
      content = content.replace(new RegExp('\\(' + sym + '\\)', 'g'), '');
      changes.push(sym + ' 기호 제거');
    }
    // 괄호 안 단독 D번호 "(D2 종속)" → 제거 (의미 중복)
    content = content.replace(new RegExp('\\(' + sym + '\\s+종속\\)', 'g'), '');
    // 텍스트 내 (D번호) 형태
    if (content.match(new RegExp('\\(' + sym + '\\)'))) {
      content = content.replace(new RegExp('\\(' + sym + '\\)', 'g'), '');
      changes.push(sym + ' 기호 제거');
    }
  }
  // "컨셉(D1)·팀 개수(D2)" 형태 — D번호만 제거, 앞 단어 보존
  content = content.replace(/\(D[1-7]\)/g, '');
  changes.push('D번호 기호 제거');

  // 규칙 A: 문서 절 참조 (§3, §3-1)
  for (const [sym, meaning] of Object.entries(SECTION_MAP)) {
    if (content.includes(sym)) {
      content = content.replace(new RegExp(sym.replace('§', '\\§'), 'g'), meaning);
      changes.push(sym + ' → ' + meaning);
    }
  }

  // 규칙 A: 내부 전문용어
  for (const [jargon, plain] of Object.entries(JARGON_MAP)) {
    if (content.includes(jargon)) {
      content = content.replace(new RegExp(jargon, 'g'), plain);
      changes.push(jargon + ' → ' + plain);
    }
  }

  // 날짜 중복 제거: 마일스톤에 이미 매핑된 순수 날짜 괄호 제거
  // "(9/3)" "(8/20)" "(8/28)" 등 순수 날짜만 있는 괄호
  const pureDateParen = /\s*\((\d{1,2}\/\d{1,2})\)\s*(?=[;,]|$)/g;
  if (pureDateParen.test(content)) {
    content = content.replace(pureDateParen, '');
    changes.push('날짜 괄호 제거 (마일스톤 중복)');
  }
  content = content.replace(/\s*\((\d{1,2}\/\d{1,2})\)$/g, '').replace(/\s{2,}/g, ' ').trim();
  // "(8/18, 8/30)" 형태 — 여러 날짜
  content = content.replace(/\s*\(\d{1,2}\/\d{1,2},\s*\d{1,2}\/\d{1,2}\)$/g, '').replace(/\s{2,}/g, ' ').trim();

  // 정리: 빈 괄호, 불필요한 공백, 끝의 대시
  content = content.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s*[—–]\s*$/, '').replace(/\s*[—–]\s*\)/g, ')').trim();
  // "()" 남은 것 정리
  content = content.replace(/\s+\(\)/g, '').trim();

  return { content, source, changes: changes.length > 0 ? [...new Set(changes)] : ['변경 없음'] };
}

// 변환 실행
const results = {};
let changedCount = 0;
for (const team of ['content', 'budget', 'exchange', 'timeline']) {
  results[team] = byTeam[team].map(item => {
    const result = transformContent(item.content, item.source, item.team, item.sortOrder);
    const changed = result.content !== item.content || result.source !== item.source;
    if (changed) changedCount++;
    return {
      id: item.id,
      team: item.team,
      sortOrder: item.sortOrder,
      originalContent: item.content,
      originalSource: item.source,
      newContent: result.content,
      newSource: result.source,
      changes: result.changes,
      changed,
    };
  });
}

console.log(`변환 완료: ${changedCount}개 항목 변경, ${94 - changedCount}개 변경 없음`);
fs.writeFileSync(tmpDir + '/checklist_transformed.json', JSON.stringify(results, null, 2));
console.log(tmpDir + '/checklist_transformed.json 작성 완료');
