# -*- coding: utf-8 -*-
"""
2026-08-15 웹앱 DB 정합성 수정 (3차 회의 전)
- 결정 메모 2건(D4/D5), 체크리스트 7건, 마일스톤 4건(2 추가·2 중복 삭제·1 수정), 팀 지침 2팀
- 서비스 롤 키로 기록, anon 키로 사후 검증은 별도 스크립트에서 수행
"""
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

results = []


def req(method, path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=HDR, method=method)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw) if raw else None


def log(ok, label, detail=''):
    results.append((ok, label, detail))
    print(('[OK] ' if ok else '[FAIL] ') + label + (' — ' + detail if detail else ''))


# ===== 1. 결정 메모 =====
try:
    req('PATCH', '/decisions?id=eq.D4', {
        'notes': '25-2 기준 1.5만원 (가이드라인: 1학기 1.3만)'
    })
    log(True, 'D4 메모 정리 (비건 문구 제거)')
except Exception as e:
    log(False, 'D4 메모 정리', str(e))

try:
    req('PATCH', '/decisions?id=eq.D5', {
        'notes': '일반 2종(참가자 선택) + 비건 1종 = 총 3종 제공. 25-2 기준: 불고기버거'
    })
    log(True, 'D5 메모 정리 (총 3종)')
except Exception as e:
    log(False, 'D5 메모 정리', str(e))

# ===== 2. 체크리스트 =====
ci = req('GET', '/checklist_items?select=id,team_id,content,completed,milestone_id&deleted_at=is.null')


def find(sub, team=None, exact=False):
    for c in ci:
        if (c['content'] == sub if exact else sub in c['content']):
            if team is None or c['team_id'] == team:
                return c
    return None


def patch_ci(item, body, label):
    try:
        req('PATCH', '/checklist_items?id=eq.' + item['id'], body)
        log(True, label)
    except Exception as e:
        log(False, label, str(e))


# (a) 점심 — 결정 완료 반영
it = find('점심 호불호')
if it:
    patch_ci(it, {
        'completed': True,
        'content': '점심 호불호 적은 메뉴 검토 완료 → 일반 2종(한식·돈치스팸 도시락)+비건 1종(서브웨이 배지) 선정',
    }, '점심 검토 완료 처리 + 결과 반영')

# (b) 단체티 시안 이중 표기 정리 → 로고 대안 항목으로
it = find('단체티 시안 (리드타임')
if it:
    patch_ci(it, {
        'content': '단체티 앞면 로고 대안 확정 (시안은 확정 상태 — 업체 컨택 결과에 따라, 8/16 이전)',
    }, '단체티 시안 항목 → 로고 대안 항목으로 교체')

# (c) 버스 운영 계획서 — 완료 근거 없음: 미완료 복귀 + 8/13 마일스톤에서 분리(상시)
it = find('버스 운영 계획서')
if it:
    patch_ci(it, {'completed': False, 'milestone_id': None},
             '버스 운영 계획서 미완료 복귀 + 8/13에서 분리')

# (d) 버스 2대 분할 기준 — 답 기록 없이 완료되어 있음: 미완료 복귀 + 분리
it = find('버스 2대 분할 기준')
if it:
    patch_ci(it, {
        'completed': False,
        'milestone_id': None,
        'content': '버스 2대 분할 기준 확정 (팀별/캠퍼스별)',
    }, '버스 분할 기준 미완료 복귀(질문형 제거) + 8/13에서 분리')

# (e) 무궁화 조건문 → 확정문
it = find('무궁화')
if it:
    patch_ci(it, {
        'content': '무궁화 탈락자 선정은 물총 대신 뿅망치 (조준 애매 — 작년 피드백)',
    }, '무궁화 조건문 → 확정문')

# (f) 교환팀 버스 명단 중복 통합
dup = find('버스 탑승자 명단 작성 (명륜 2대 분할')
keep = find('버스 탑승 명단 작성 (명륜 2대 / Suwon 직행)')
if dup and keep:
    patch_ci(keep, {
        'content': '버스 탑승 명단 작성 (명륜 2대 분할 / Suwon 직행 — 25-2 버스 80석 기준)',
    }, '버스 명단 항목 통합(내용 병합)')
    try:
        req('PATCH', '/checklist_items?id=eq.' + dup['id'], {'deleted_at': '2026-08-15T00:00:00Z'})
        log(True, '버스 명단 중복 항목 삭제(soft)')
    except Exception as e:
        log(False, '버스 명단 중복 삭제', str(e))

# ===== 3. 마일스톤 =====
ms = req('GET', '/milestones?select=id,date,title,category,team_id,completed,sort_order&deleted_at=is.null')

# (g) 하클 조사 8/17 → 8/17~19 (마감일 8/19로)
for m in ms:
    if m['date'][:10] == '2026-08-17' and m['title'].startswith('하클'):
        try:
            req('PATCH', '/milestones?id=eq.' + m['id'],
                {'date': '2026-08-19', 'title': '하클 가용인원 조사 (8/17~19)'})
            log(True, '하클 조사 8/17~19 표기 (마감 8/19)')
        except Exception as e:
            log(False, '하클 조사 표기', str(e))

# (h) 신규: 3차 회의(8/16) + 구글폼 배포(8/21)
new_meeting = str(uuid.uuid4())
new_deploy = str(uuid.uuid4())
try:
    req('POST', '/milestones', [{
        'id': new_meeting, 'date': '2026-08-16', 'title': '기획팀 3차 회의',
        'team_id': None, 'category': 'meeting', 'completed': False,
        'depends_on': None, 'sort_order': 29,
    }])
    log(True, '마일스톤 추가: 기획팀 3차 회의 (8/16)')
except Exception as e:
    log(False, '3차 회의 추가', str(e))

try:
    req('POST', '/milestones', [{
        'id': new_deploy, 'date': '2026-08-21', 'title': '구글폼 배포',
        'team_id': 'exchange', 'category': 'deliverable', 'completed': False,
        'depends_on': None, 'sort_order': 30,
    }])
    log(True, '마일스톤 추가: 구글폼 배포 (8/21, 교환)')
except Exception as e:
    log(False, '구글폼 배포 추가', str(e))

# 배포 체크항목을 신규 마일스톤에 연결
it = find('구글폼 배포', exact=True)
if it and new_deploy:
    patch_ci(it, {'milestone_id': new_deploy}, '구글폼 배포 체크항목 → 8/21 마일스톤 연결')

# (i) 9/18·9/19 중복 삭제 (자식 있는 deliverable/event 유지, meeting쪽 soft delete)
for m in ms:
    if m['date'][:10] == '2026-09-18' and m['category'] == 'meeting':
        try:
            req('PATCH', '/milestones?id=eq.' + m['id'], {'deleted_at': '2026-08-15T00:00:00Z'})
            log(True, "9/18 중복 삭제(soft) — '최종브리핑'(meeting) 제거, deliverable 유지")
        except Exception as e:
            log(False, '9/18 중복 삭제', str(e))
    if m['date'][:10] == '2026-09-19' and m['category'] == 'meeting':
        try:
            req('PATCH', '/milestones?id=eq.' + m['id'], {'deleted_at': '2026-08-15T00:00:00Z'})
            log(True, "9/19 중복 삭제(soft) — 'Sports Day'(meeting) 제거, event 유지")
        except Exception as e:
            log(False, '9/19 중복 삭제', str(e))

# ===== 4. 팀 지침 (content 3곳 + management 1곳) =====
teams = req('GET', '/teams?select=id,guideline_doc')

NEW_GAME_SECTION_MD = (
    '## 🎯 게임 뼈대는 8/9 선정 12종, 그 위에 인사이드아웃 컨셉 입히기\n'
    '**원칙.** 게임 종목은 **8/9 2차 회의에서 선정한 12종** — '
    '토너먼트(피구·줄다리기·판 뒤집기·무궁화) / 메인(혼성 계주·짝짓기) / '
    '미니(비어퐁·감정 몸짓 퀴즈·병뚜껑 컬링·페트병 세우기·단체 줄넘기·제기차기) — '
    '을 뼈대로 하고, 네이밍·소품·진행 멘트에 인사이드아웃 감정 테마'
    '(Joy/Sadness/Anger/Disgust/Fear/Anxiety)를 입혀 각색한다. '
    '25-2(율전) 세트는 검증된 참고 자료일 뿐 종목을 묶는 기준이 아니다.\n\n'
    '왜: 팀원 3명이 각자 종목을 구상해 브레인스토밍으로 취합했고(8/9), '
    '25-2에 없는 무궁화·비어퐁 등 신규 종목이 포함됐다. 같은 장소(율전)에서 검증된 25-2 구성은 '
    '안전장치로 참고하되, 선정된 12종이 기준이다. 컨셉은 스킨으로 씌우면 된다.\n'
    '참고: [25-2 게임 구성 및 규칙](../25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 게임 구성 및 규칙.docx)'
)


def fix_content(doc):
    changed = 0
    for s in doc.get('sections', []):
        md = s.get('content_md', '')
        if '25-2(율전) 세트' in s.get('title', ''):
            s['title'] = '🎯 게임 뼈대는 8/9 선정 12종, 그 위에 인사이드아웃 컨셉 입히기'
            s['content_md'] = NEW_GAME_SECTION_MD
            changed += 1
        if '최소 3위 점수 보장' in md:
            s['content_md'] = md.replace('최소 3위 점수 보장', '최소 5위 점수 보장')
            changed += 1
        if '6팀 전환 설계(토너먼트 100/85/70/55/40/40, 메인 100/85/70/55/40/20)를 출발점으로 삼는다' in md:
            s['content_md'] = md.replace(
                '6팀 전환 설계(토너먼트 100/85/70/55/40/40, 메인 100/85/70/55/40/20)를 출발점으로 삼는다.',
                '2차 회의(8/9) 잠정안인 100/80/60/40/20/10을 출발점으로 삼는다. '
                '메인과 토너먼트의 배점 차별화는 8/16 회의에서 확정한다.')
            changed += 1
        # 참고자료의 '주 뼈대' 표현 완화
        if '주 뼈대' in s['content_md'] and '25-2 게임 구성' in s['content_md']:
            lines = s['content_md'].split('\n')
            for i, ln in enumerate(lines):
                if '25-2 게임 구성' in ln and '주 뼈대' in ln:
                    lines[i] = ln.replace('주 뼈대', '참고 자료 (종목 기준은 8/9 선정 12종)')
            s['content_md'] = '\n'.join(lines)
            changed += 1
    return changed


def fix_management(doc):
    changed = 0
    for s in doc.get('sections', []):
        md = s.get('content_md', '')
        if '팀당 약 25명' in md:
            s['content_md'] = md.replace(
                '팀당 약 25명', '팀당 교환 약 25명 + 하클 배치(팀장 등) 별도')
            changed += 1
    return changed


for t in teams:
    if t['id'] == 'content':
        n = fix_content(t['guideline_doc'])
        if n:
            try:
                req('PATCH', '/teams?id=eq.content', {'guideline_doc': t['guideline_doc']})
                log(True, 'content 지침 갱신 (%d곳)' % n)
            except Exception as e:
                log(False, 'content 지침 갱신', str(e))
    if t['id'] == 'management':
        n = fix_management(t['guideline_doc'])
        if n:
            try:
                req('PATCH', '/teams?id=eq.management', {'guideline_doc': t['guideline_doc']})
                log(True, 'management 지침 갱신 (%d곳)' % n)
            except Exception as e:
                log(False, 'management 지침 갱신', str(e))

print()
fails = [r for r in results if not r[0]]
print('완료: %d건 / 실패: %d건' % (len(results) - len(fails), len(fails)))
