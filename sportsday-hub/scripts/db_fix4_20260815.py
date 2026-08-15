# -*- coding: utf-8 -*-
"""2026-08-15 (3) 단체티 — 탑앤탑(25-2 실적)을 이번 업체처럼 쓰던 표기 정정 + D6 상태 갱신"""
import json
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


# 1) 체크리스트: 주문처(탑앤탑, 단가 12,400원) — 활성 항목을 실제 상황으로
ci = req('GET', '/checklist_items?select=id,content&team_id=eq.budget&deleted_at=is.null', key=ANON)
for c in ci:
    if '주문처(탑앤탑' in c['content'] and '8/9' not in c['content']:
        req('PATCH', '/checklist_items?id=eq.' + c['id'], {
            'content': '수량(팀 배정 9/3 후) + 주문처 확정(여러 업체 견적 비교 중 — 디자인 변경 후 재견적)'})
        print('[OK] 체크리스트 정정(탑앤탑 제거)')

# 2) D6 상태 갱신 (고연준 8/15 카톡 기준)
req('PATCH', '/decisions?id=eq.D6', {
    'current_value': '여러 업체 컨택 완료 → 견적이 비싸 디자인(앞면 로고) 변경 후 견적 재문의 중 (8/15 기준). 수량은 9/3 팀 배정 후, 주문 9/4 예정'})
print('[OK] D6 상태 갱신')

# 3) 검증
print()
print('=== 검증 (anon) ===')
for c in req('GET', '/checklist_items?select=content,completed&deleted_at=is.null', key=ANON):
    if '탑앤탑' in c['content']:
        print('  [%s] %s' % ('V' if c['completed'] else ' ', c['content'][:80]))
d = req('GET', '/decisions?select=current_value,notes&id=eq.D6', key=ANON)[0]
print('D6 값:', d['current_value'])
print('D6 메모(25-2 참고라 유지):', d['notes'])
