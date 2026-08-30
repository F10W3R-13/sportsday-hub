// 데모 인스턴스 전용 모듈 — NEXT_PUBLIC_DEMO_MODE=1 로 켠 배포에서만 활성.
//
// 목적: 채용용 읽기 전용 데모에서 실수/악성 쓰기를 UI 단에서 차단.
// 진짜 강제는 데모 Supabase 프로젝트의 read-only RLS(supabase/demo/001)가 담당하며,
// 이 가드는 그 위의 UX 방어선이다. 운영 배포에서는 IS_DEMO=false로 전부 무동작.

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

export const DEMO_BLOCK_MESSAGE =
  '읽기 전용 데모입니다 — 변경 사항은 저장되지 않아요.'

// 쓰기 메서드 차단 대상 (supabase-js PostgrestQueryBuilder 기준)
const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])

// 데모 모드에서 쓰기 체인(insert/update/upsert/delete)을 시작하는 순간 예외로 끊는다.
// select 등 읽기 체인은 그대로 통과. RLS가 이미 쓰기를 거부하지만,
// 사용자에게 네트워크 에러 대신 안내 문구(toast)로 안내하기 위한 1차 방어선.
export function guardDemoWrites<T>(client: T): T {
  if (!IS_DEMO) return client
  return new Proxy(client as object, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (WRITE_METHODS.has(String(prop))) {
        return () => {
          throw new Error(DEMO_BLOCK_MESSAGE)
        }
      }
      return value
    },
  }) as T
}
