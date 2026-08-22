import { describe, it, expect, vi } from 'vitest'
import { notifyTabs, onTabSync } from '@/lib/sync'

describe('lib/sync (node 환경 — BroadcastChannel 미지원)', () => {
  it('notifyTabs는 BroadcastChannel 없을 때 에러 없이 no-op', () => {
    expect(() => notifyTabs({ type: 'tasks-updated' })).not.toThrow()
  })

  it('onTabSync는 BroadcastChannel 없을 때 더미 해제 함수 반환', () => {
    const handler = vi.fn()
    const unsubscribe = onTabSync(handler)
    expect(typeof unsubscribe).toBe('function')
    expect(() => unsubscribe()).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
})
