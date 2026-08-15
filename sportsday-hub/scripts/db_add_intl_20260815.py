# -*- coding: utf-8 -*-
"""2026-08-15 국제처 컨택 트래킹 항목을 기관팀(management) 체크리스트에 추가 (상시 버킷)"""
import json
import uuid
import urllib.request

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()

BASE = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1'
SERVICE = env['SUPABASE_SERVICE_ROLE_KEY']
HDR = {
    'apikey': SERVICE,
    'Authorization': 'Bearer ' + SERVICE,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

body = [{
    'id': str(uuid.uuid4()),
    'team_id': 'management',
    'content': '국제처 컨택 — 지원 요청 방향 결정(8/16 3차 회의) → 요청서 제출 또는 업체 대여 분기 (천막/First Aid/대여물품/우천 대응)',
    'priority': 'medium',
    'completed': False,
    'milestone_id': None,
    'sort_order': 0,
}]

req = urllib.request.Request(
    BASE + '/checklist_items',
    data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
    headers=HDR, method='POST')
with urllib.request.urlopen(req) as r:
    print('POST OK:', r.status)

# anon 검증
HDR2 = {'apikey': env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        'Authorization': 'Bearer ' + env['NEXT_PUBLIC_SUPABASE_ANON_KEY']}
req = urllib.request.Request(
    BASE + '/checklist_items?team_id=eq.management&select=team_id,content,completed',
    headers=HDR2)
with urllib.request.urlopen(req) as r:
    rows = json.load(r)
for c in rows:
    print('[%s] %s | %s' % ('V' if c['completed'] else ' ', c['team_id'], c['content'][:80]))
