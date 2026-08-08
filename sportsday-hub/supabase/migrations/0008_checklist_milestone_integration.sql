-- 0008: 체크리스트·타임라인 통합
-- checklist_items.section 제거, milestone_id FK 추가

BEGIN;

-- ===== 스키마 변경 =====
-- milestone_id FK 추가 (nullable: NULL = 상시 버킷)
alter table public.checklist_items
  add column if not exists milestone_id uuid
  references public.milestones(id) on delete set null;

-- 인덱스 (마일스톤별 조회 빈도 high)
create index if not exists idx_checklist_items_milestone_id
  on public.checklist_items (milestone_id);

-- section 컬럼 제거
alter table public.checklist_items drop column if exists section;

-- ===== 시드 재매핑: 각 체크리스트 항목에 milestone_id 설정 =====
-- 마일스톤 UUID는 0005_seed_data.sql 참조

-- --- content 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '754128ed-df14-4aee-8892-d0a04caf1e18',  -- 심판 규칙 사전 숙지
    '53d79cbd-b38c-45ad-9e13-8b4e3a79b8f6',  -- 토너먼트 균형 배분
    'e24c5cbc-eabc-4877-9355-30269db00188',  -- 미니게임 유도
    'c6bff0cd-4d76-4f05-92d8-10f41baaef35',  -- 규칙 설명 더 명확히
    '536b76df-6b20-453e-82d2-ed8523258a31',  -- 토너먼트 무궁화 채택 시
    'e821087a-90c3-4979-8ee1-6314234d4e2a'   -- 페이스페인팅 유지
  );

-- progress → 마일스톤 매핑
update public.checklist_items set milestone_id = '05e80dca-3781-4386-b44a-65e590be03d0'  -- 8/9 기획팀 2차 회의
  where id = '939f0e15-b48b-4ca6-bdc5-b38428319f56';  -- 컨셉(D1)·팀 개수(D2) 수령

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성
  where id in (
    'f6429af2-863e-4166-a732-8f80a95548d1',  -- 토너먼트 4종 확정
    '1630a01e-a68d-4cec-a1cb-211c190aff0b',  -- 메인게임 2종 확정
    '56a4eab9-550e-4f40-9c1e-dab34fc8c815',  -- 미니게임 6종 확정
    'ddbb10aa-7bab-446d-b6ea-ff247efee7dd',  -- 각 게임별 상세 시트 작성
    '21f56dac-d5d3-4ef5-a3b7-18dacc9eb307',  -- 점수배분 체계 확정
    '728a5f1a-3033-48b4-8e3b-7f7ec74f16b1',  -- 필요 물품 리스트 → 예산팀 인계
    '35821fe8-64df-47c8-b17e-442e918ae15f'   -- 율전 대운동장 배치도 작성
  );

update public.checklist_items set milestone_id = '80d4d35c-9b1d-4bd5-ac8c-ba80e2af016a'  -- 9/18 최종 브리핑 (심판 배정 3일 전)
  where id = '1a286c8b-1485-4e0f-8330-514f0a6ba064';  -- 심판 배정표 (최소 3일 전)

update public.checklist_items set milestone_id = '6461433b-f463-4082-b909-fd721f929731'  -- 8/30 컨텐츠 안내 홍보부 인계
  where id = '8cc9ec56-98d1-4de3-8a94-d80d3b054e54';  -- 컨텐츠 안내 → 교환담당팀 인계

-- --- budget 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '1e24a590-3830-4336-a008-7294ea272bc3',  -- 율전 브룸에 물품 미리 비치
    '2b46ba62-60ca-4eb5-81b1-51c8b54cc13e',  -- 점심 호불호 적은 메뉴 검토
    '087b9546-52c4-44c7-8cc4-bfc0c16856b2',  -- 음식물 쓰레기통 별도 비치
    '57321bec-7814-4cde-9689-2c019d9d7103',  -- 비건 음식 지연 주의
    '91828980-44ed-4b47-b61a-0c85a6365ef3',  -- 중간 간식 제공 검토
    '70b5742e-b07e-45c0-969f-c5876a15feec',  -- 물총 교환학생 자유 사용 허용 검토
    '961f82c9-1fbf-4219-87ae-79096b009ebd'   -- SG MAPLE 챙기기
  );

-- progress
update public.checklist_items set milestone_id = '05e80dca-3781-4386-b44a-65e590be03d0'  -- 8/9 기획팀 2차 회의
  where id in (
    'e06dc6cf-b0d7-4bc0-b357-7232e1bd84f6',  -- 8/9 회의: 주문처 리드타임 확인
    '92ce63d1-cfab-47f9-82b1-b72749864bf2',  -- 단체티 방침 + 리드타임 확인
    'cf501751-29c6-498f-b584-2a51e61de9c9',  -- 점심 메뉴 방향 논의
    '25897d0b-3a6b-4948-960e-ac6414b6203f',  -- 신규 제작 전제
    '1bbdb684-4faa-4257-8648-2aea30eb1986'   -- 시안(컨셉 연동)
  );

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성 (게임 물품 리스트 수령)
  where id = '37456e61-5177-4011-8a20-4689b050df54';  -- 게임 물품 리스트 수령

update public.checklist_items set milestone_id = '313c6967-1b39-4ae2-9170-efbec25a491d'  -- 8/25 최종기획안 완성
  where id in (
    '12ddc088-5491-4729-941f-180bfa96a336',  -- 입장료 결정 (8/16~8/25)
    '414bb4aa-2fbc-4c4e-b9e1-179c45557e20',  -- 예산안 작성
    '1dcde297-f2e3-4abc-8f7a-7a6b1e4b0ccc'   -- 단체티 시안
  );

update public.checklist_items set milestone_id = '5bad5e6b-20a2-4554-a862-27c549231c5f'  -- 8/28 구글폼 접수 마감 (참여 인원 확정)
  where id = '8772d8fb-4cdf-4083-a06a-83c010de8b84';  -- 참여 인원 확정 후 식사 수량 조정

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id = '21fcb85c-fc51-4e6f-a975-d3d8b3a71a7d';  -- 팀 배정 후 단체티 수량 확정

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id = '70bd13fd-75ce-4757-bca0-7c8e39723920';  -- 수량(팀 배정 9/3 후) + 주문처(탑앤탑)

update public.checklist_items set milestone_id = 'ee855044-a221-49c0-bb97-5027db3ae01b'  -- 9/3 준비물 주문
  where id = '82117660-2793-437f-84a8-ad7964f4c593';  -- 준비물 주문 (9/3)

update public.checklist_items set milestone_id = '5417292e-5850-4ea8-940c-acc99f2c088b'  -- 9/4 단체티 주문
  where id = '2a64be7d-38b2-4200-a20a-b816ec4b42a2';  -- 단체티 주문 (9/4)

update public.checklist_items set milestone_id = '0e960487-b65d-4fe0-a876-c58a6799cb69'  -- 8/31 수금 부스
  where id = 'b583f3d6-77ff-4e60-a453-ee32fcaaac54';  -- 수금 부스 운영 (8/31)

update public.checklist_items set milestone_id = null  -- 상시
  where id = 'c7416f8f-d98d-405a-b914-01fb948059f0';  -- 물품 상태 지속 업데이트

-- --- exchange 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '143a2d0c-d950-48fd-950b-dfded2a5e11a',  -- 입장 결제 확인 receipt 제공
    '515477d7-db7f-4bd5-94bc-02af0b3f427d',  -- 율전/명륜 도착 시간차 최소화
    'e60c4e7c-7e8f-418e-9ef5-c7ffd5aa7acd',  -- 입장 시 팀별 노래 + 깃발
    'b8b6cf94-10c8-4e75-bed7-8bcf86fd5826'   -- 추가 접수 시스템 사전 준비
  );

update public.checklist_items set milestone_id = '6461433b-f463-4082-b909-fd721f929731'  -- 8/30 컨텐츠 안내 홍보부 인계 (성별 항목은 컨텐츠와 연관)
  where id = '8e6f0b6e-fe26-405f-aec0-8b5a3438438c';  -- 구글폼 성별 항목 기본 포함 (completed=true)

-- progress
update public.checklist_items set milestone_id = 'b3b447fa-fa83-4d90-85c0-3ad5cd619466'  -- 8/20 구글폼 완성
  where id in (
    'c73063da-9b99-4d4a-9f4a-3f4f2146ba70',  -- 25-2 구글폼/안내문 양식 확보
    '3a893f46-92ef-4b46-8f71-33cce84507f1',  -- 26-1 출석부·피드백 확보
    '62a66789-14d7-4116-833d-edbaeff224f0',  -- 구글폼 제작
    '141408e8-c597-4619-9d96-ab441a7f2b89'   -- 구글폼 완성 (8/20)
  );

update public.checklist_items set milestone_id = null  -- 상시 (구글폼 배포는 완성 직후, 명확한 마일스톤 없음)
  where id = 'f37c19d3-f76d-4f3a-b4db-8ccc4aa41a9f';  -- 구글폼 배포

update public.checklist_items set milestone_id = '5bad5e6b-20a2-4554-a862-27c549231c5f'  -- 8/28 구글폼 접수 마감
  where id in (
    'bc2bf18f-e37c-48b3-9e94-246664171f92',  -- 접수 마감 (8/28)
    '63c8598a-d689-4019-82c5-c6c18b16e1ff',  -- 폼 마감 후 응답 수합
    '017dc833-c651-4751-98cd-c4a33cef812b',  -- Departure Location별 분류
    'b58bc9f3-2aae-4c8a-b77a-e8704cb1f2f0',  -- 식이제한별 집계
    '965735fe-77ff-4108-aa96-12aeeb5b37c4',  -- 티셔츠 사이즈별 집계
    'f716dda2-d0d5-4335-85bd-1a5d8b9f511d',  -- 성비 집계
    'b57b4846-10e6-4bc1-b992-25131aa08431',  -- 지인 요청 매칭 정리
    'b0f741de-e9ab-4173-8cef-0f93234993c0',  -- 추가 접수 인원 별도 집계
    '613ce841-6d17-4481-9c22-bba4c9beb029',  -- 수금 완료 여부 체크
    '97c33846-3568-46ab-9902-99f4aec739be',  -- 추가 접수 필요성 판단 → 폼 개설
    '1e00b89c-8728-4545-8e02-c3c7c1abdc17'   -- 응답 수합·명단 정리
  );

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id in (
    '9452af51-dc18-47f8-bf7a-4c16f6aa3779',  -- 교환 팀 배정 (9/3)
    'fa9ab995-51f6-418f-9764-b9b4a1455a46',  -- 팀 편성 표 작성
    '6ff31d58-318d-4eee-bc0a-20e6c4f3d40f',  -- 버스 탑승자 명단 작성 (명륜 분할)
    '7eb07c1e-4ec3-4798-aa6e-071660eaf68b'   -- 버스 탑승 명단 작성 (명륜 2대 / Suwon)
  );

update public.checklist_items set milestone_id = '3f459a38-0242-41c3-adbf-eee8f8562fb4'  -- 8/18 카드뉴스 홍보부 인계
  where id = 'eddbd511-de62-4b04-aaa7-c26c561d1453';  -- 카드뉴스 인계물 제작

update public.checklist_items set milestone_id = 'f63fbaa4-cb7b-4e87-aabc-4f8217c1cd19'  -- 8/27 카드뉴스 업로드
  where id = '40f95907-b1b2-43da-9a4d-3fe619c51d9f';  -- 홍보부 인계 (8/18, 8/30) — 8/18 인계 기준

update public.checklist_items set milestone_id = 'f63fbaa4-cb7b-4e87-aabc-4f8217c1cd19'  -- 8/27 카드뉴스 업로드
  where id = '10d31112-9a00-4ff8-a836-c3eb8f2480f0';  -- 카드뉴스 업로드 (8/27, 9/7)

update public.checklist_items set milestone_id = '7ef8ed20-b0e8-4109-83df-f76589def7cb'  -- 9/4 교환학생 정보방 개설
  where id = '50fb78e5-6769-4c20-aa10-7586583ade2b';  -- 교환학생 정보방 개설 (9/4)

-- --- timeline 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    'd6176869-d975-455f-b3a8-7b86971160c6',  -- 사회자 영어 편한 사람 배정
    '41052cc7-bddb-4112-b6ae-652c8456ac23',  -- 심판 역할 배정 3일 전
    '5c03e10c-5c77-405f-9355-0e718cbb1603',  -- 명륜조/율전조 도착 시간차 최소화
    '16fb1ade-296b-47ed-83ca-dd25f9c70c8c',  -- 입장 시 팀별 노래 + 깃발
    '09753407-4f57-4d9e-b446-63a6cd33862d',  -- 점수 집계 노트북 필수
    '222f895b-5f10-4cc6-bdcd-41c8b11f2ae8',  -- 개회 K-pop BGM
    '69d99fc1-8db6-45e9-806e-bc93b705dbed',  -- 국민체조 시범 편성
    'ea499b92-b929-4bca-9ff8-3d473454f5eb'   -- 귀환 셔틀 18:30 고정
  );

-- progress
update public.checklist_items set milestone_id = '8b316af3-9b1e-424c-87ed-93ba60d9abf9'  -- 8/13 타임라인 완성
  where id in (
    '4712bc8b-ee4e-4b18-b337-d10acbc2a388',  -- 전체 타임라인 완성 (8/13)
    '4cb293c8-b8e2-4a0a-9198-5427d937ff84',  -- 명륜조 집합 장소 확정
    '341a9b9e-a592-4c8a-8d44-5cc34f1925aa',  -- 버스 탑승지 확정
    '85b876e6-721c-43ec-bcad-a860a5a35747',  -- 버스 2대 분할 기준
    '977a7592-4670-48f1-9168-9166835362b2'   -- 귀환 셔틀 위치 확정
  );

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성 (게임 소요시간 수령)
  where id = '771fe712-ab46-40b3-942e-33ca571504c8';  -- 컨텐츠팀 게임 소요시간 수령 (8/16 이후)

update public.checklist_items set milestone_id = 'd98d89c3-50e8-4d85-a765-bd327d284199'  -- 8/17 하클 가용인원 조사
  where id = '9f201b9c-46f0-407c-a5c7-a150fe470c84';  -- 하클 가용인원 조사 (8/17)

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료 (팀장 6명 확정, 하클 배치)
  where id in (
    '5f75fe73-df32-4859-8891-dde88649218d',  -- 교환 팀 배정 결과 수령 → 팀장 6명 확정
    '902c4cc4-9307-4159-b3cf-09f4a1b2a4d4',  -- 버스 탑승 명단 작성 (교환에서 전달)
    'ec7617cb-3690-4a2f-905f-49c6d4078754',  -- 하클 역할 배치표 작성
    'f5c6e9fa-e63a-4134-b708-bb0fa39345b9',  -- 심판 배정표 (최소 3일 전)
    '9d8d8b33-22b7-44c8-9041-53f35df2c8f6',  -- 상차 6/탑승안내 10 인력 배정 (오전)
    'bc03aa7f-c0fb-4f36-b22b-c326e87c729a',  -- 오후 상차 3/탑승안내 4 인력 배정
    'd991a897-49e2-48d4-96fb-65b06739ba1a'   -- 버스 인력 23명 배정 (오전 16/오후 7)
  );

update public.checklist_items set milestone_id = '8b316af3-9b1e-424c-87ed-93ba60d9abf9'  -- 8/13 타임라인 완성 (버스 운영 계획서는 타임라인 산출물)
  where id = 'f562615b-5b35-49fa-bc7a-ecff1624408c';  -- 명륜→율전 버스 운영 계획서 (이중 집합 + 귀환 셔틀 포함)

update public.checklist_items set milestone_id = '6c0a214f-9e96-48d0-8f07-6c969bb19ca8'  -- 9/19 Sports Day
  where id in (
    'fbae130d-4016-44c2-8f72-80ecdb74bc11',  -- 버스 대기 중 프로그램 검토
    '07f66d1b-a61f-4640-8482-2307ba2582f3',  -- 율전 도착 후 인솔 동선
    'be460d84-b20a-4e57-af4c-ae9978f90c92'   -- 행사 당일 타임라인 시트 작성
  );

COMMIT;
