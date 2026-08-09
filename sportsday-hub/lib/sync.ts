const CHANNEL_NAME = 'sportsday-sync'

export type SyncMessage =
  | { type: 'checklist-updated' }
  | { type: 'milestone-updated' }

/**
 * 다른 탭에 상태 변경을 알린다.
 * SSR 환경(window 없음)이나 BroadcastChannel 미지원 브라우저는 no-op.
 * BroadcastChannel은 동일 탭의 송신을 자기 자신에게 전달하지 않는다(표준 동작).
 */
export function notifyTabs(msg: SyncMessage): void {
  if (typeof BroadcastChannel === 'undefined') return
  const ch = new BroadcastChannel(CHANNEL_NAME)
  ch.postMessage(msg)
  ch.close()
}

/**
 * 탭 동기화 메시지를 구독한다. 구독 해제 함수를 반환한다.
 * 미지원 환경은 더미 해제 함수를 반환하여 호출부가 방어 코드 없이 동작.
 */
export function onTabSync(handler: (msg: SyncMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL_NAME)
  ch.onmessage = (e: MessageEvent<SyncMessage>) => handler(e.data)
  return () => ch.close()
}
