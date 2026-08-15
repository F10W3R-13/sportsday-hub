# -*- coding: utf-8 -*-
"""2026-08-15 (2) '동아리'->'하이클럽' 통일 + 예산팀 지침 md 재동기화"""
import json
import re
import urllib.request

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()

BASE = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1'
SERVICE = env['SUPABASE_SERVICE_ROLE_KEY']
ANON = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
HDR = {'apikey': SERVICE, 'Authorization': 'Bearer ' + SERVICE,
       'Content-Type': 'application/json', 'Prefer': 'return=representation'}


def req(method, path, body=None, key=None):
    h = dict(HDR)
    if key:
        h['apikey'] = key
        h['Authorization'] = 'Bearer ' + key
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw) if raw else None


# ===== 1. 체크리스트: 입장료 항목 (동아리 + 물결표 교체) =====
ci = req('GET', '/checklist_items?select=id,content&team_id=eq.budget&deleted_at=is.null', key=ANON)
for c in ci:
    if '동아리' in c['content']:
        new = c['content'].replace('동아리', '하이클럽').replace('~', '-')
        req('PATCH', '/checklist_items?id=eq.' + c['id'], {'content': new})
        print('[OK] 체크리스트 교체:', new[:70])

# ===== 2. 예산팀 지침: 현재 md에서 재동기화 =====
md = open('content-source/teams/budget.md', encoding='utf-8').read()
lines = md.split('\n')

starts = []  # (idx, title)
for i, ln in enumerate(lines):
    if ln.startswith('### '):
        starts.append((i, ln[4:].strip()))
    elif ln.startswith('## 🔗'):
        starts.append((i, ln[3:].strip()))

sections = []
for n, (idx, title) in enumerate(starts):
    end = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
    body = [l for l in lines[idx + 1:end]]
    while body and body[0].strip() in ('', '---'):
        body.pop(0)
    while body and body[-1].strip() in ('', '---'):
        body.pop()
    content_md = '## ' + title + '\n' + '\n'.join(body)
    sid = re.sub(r'[^가-힣a-zA-Z0-9]+', '-', title).strip('-')[:30]
    sections.append({'id': str(n + 1) + '-' + sid, 'title': title, 'order': n, 'content_md': content_md})

# 기존 id 보존 (제목 일치 시)
teams = req('GET', '/teams?select=id,guideline_doc', key=ANON)
budget_team = next(t for t in teams if t['id'] == 'budget')
old_titles = {s.get('title'): s.get('id') for s in budget_team['guideline_doc'].get('sections', [])}
for s in sections:
    if s['title'] in old_titles:
        s['id'] = old_titles[s['title']]

req('PATCH', '/teams?id=eq.budget', {'guideline_doc': {'sections': sections}})
print('[OK] budget 지침 재동기화 — 섹션 %d개:' % len(sections))
for s in sections:
    print('   -', s['title'][:50])

# ===== 3. management 지침: 동아리 -> 하이클럽 =====
mg = next(t for t in teams if t['id'] == 'management')
raw = json.dumps(mg['guideline_doc'], ensure_ascii=False)
if '동아리' in raw:
    import copy
    doc = copy.deepcopy(mg['guideline_doc'])
    cnt = 0
    for sec in doc.get('sections', []):
        for field in ('title', 'content_md'):
            if field in sec and '동아리' in sec[field]:
                cnt += sec[field].count('동아리')
                sec[field] = sec[field].replace('동아리', '하이클럽')
    req('PATCH', '/teams?id=eq.management', {'guideline_doc': doc})
    print('[OK] management 지침: 동아리 %d건 -> 하이클럽' % cnt)

# ===== 4. 검증 =====
print()
print('=== 검증 (anon) ===')
bad = 0
for c in req('GET', '/checklist_items?select=content&deleted_at=is.null', key=ANON):
    if '동아리' in c['content']:
        bad += 1
        print('  [체크리스트 잔존]', c['content'][:60])
for d in req('GET', '/decisions?select=id,current_value,notes', key=ANON):
    if '동아리' in (d.get('current_value') or '') + (d.get('notes') or ''):
        bad += 1
        print('  [결정 잔존]', d['id'])
for t in req('GET', '/teams?select=id,guideline_doc', key=ANON):
    doc = json.dumps(t['guideline_doc'], ensure_ascii=False)
    if '동아리' in doc:
        bad += 1
        print('  [지침 잔존]', t['id'])
print('DB 동아리 잔존:', bad, '건')
