import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  shouldPromptNickname,
  ensureContext,
  requestNicknameViaProvider,
  getNickname,
  setNickname,
  NICKNAME_PROMPT_EVENT,
  type NicknameGateInput,
  type NicknamePromptDetail,
} from '@/lib/supabase/client'

describe('shouldPromptNickname (닉네임 게이트 순수 판정)', () => {
  it('provider 미준비(SSR·테스트 환경)면 절대 프롬프트하지 않는다', () => {
    const base: NicknameGateInput = {
      hasNickname: false,
      promptedThisSession: false,
      providerReady: false,
    }
    expect(shouldPromptNickname(base)).toBe(false)
    expect(shouldPromptNickname({ ...base, hasNickname: true })).toBe(false)
    expect(shouldPromptNickname({ ...base, promptedThisSession: true })).toBe(false)
  })

  it('닉네임 없음 + 세션 내 미프롬프트 + provider 준비됨일 때만 프롬프트', () => {
    const input: NicknameGateInput = {
      hasNickname: false,
      promptedThisSession: false,
      providerReady: true,
    }
    expect(shouldPromptNickname(input)).toBe(true)
  })

  it('닉네임이 있으면 프롬프트하지 않는다', () => {
    const input: NicknameGateInput = {
      hasNickname: true,
      promptedThisSession: false,
      providerReady: true,
    }
    expect(shouldPromptNickname(input)).toBe(false)
  })

  it('세션 내 이미 프롬프트했으면 다시 하지 않는다', () => {
    const input: NicknameGateInput = {
      hasNickname: false,
      promptedThisSession: true,
      providerReady: true,
    }
    expect(shouldPromptNickname(input)).toBe(false)
  })
})

describe('ensureContext 닉네임 게이트 배선', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage() {
    const local = new Map<string, string>()
    const session = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => local.set(k, v),
    })
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => session.set(k, v),
    })
    return { local, session }
  }

  function stubWindow(options: { ready: boolean }) {
    const listeners = new Map<string, Set<(e: Event) => void>>()
    const win = {
      __sportsdayNicknameGateReady: options.ready,
      addEventListener: (type: string, fn: (e: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(fn)
      },
      removeEventListener: (type: string, fn: (e: Event) => void) => {
        listeners.get(type)?.delete(fn)
      },
      dispatchEvent: (event: Event) => {
        listeners.get(event.type)?.forEach((fn) => fn(event))
        return true
      },
    }
    vi.stubGlobal('window', win)
    return win
  }

  const fakeClient = () => ({ rpc: vi.fn().mockResolvedValue(undefined) })

  it('provider 미준비면 프롬프트 없이 익명으로 진행 (데드락 방지)', async () => {
    const { session } = stubStorage()
    stubWindow({ ready: false })
    const client = fakeClient()

    await ensureContext(client as never)

    expect(client.rpc).toHaveBeenCalledWith('set_user_context', { p_nickname: '익명' })
    expect(session.has('sportsday-nickname-prompted')).toBe(false)
  })

  it('스토리지 접근이 throw하는 환경(프라이버시 모드)이어도 reject 없이 익명으로 진행', async () => {
    const throwOnAccess = () => {
      throw new Error('The operation is insecure.')
    }
    vi.stubGlobal('localStorage', {
      getItem: throwOnAccess,
      setItem: throwOnAccess,
    })
    vi.stubGlobal('sessionStorage', {
      getItem: throwOnAccess,
      setItem: throwOnAccess,
    })
    const win = stubWindow({ ready: true })
    const onPrompt = vi.fn()
    win.addEventListener(NICKNAME_PROMPT_EVENT, onPrompt)
    const client = fakeClient()

    await expect(ensureContext(client as never)).resolves.toBeUndefined()

    expect(client.rpc).toHaveBeenCalledWith('set_user_context', { p_nickname: '익명' })
    // 세션 플래그 접근 불가 → 프롬프트 생략 정책: 이벤트 없이 진행
    expect(onPrompt).not.toHaveBeenCalled()
  })

  it('닉네임 있으면 프롬프트 없이 닉네임으로 진행', async () => {
    const { local } = stubStorage()
    local.set('sportsday-nickname', '지훈')
    stubWindow({ ready: true })
    const client = fakeClient()

    await ensureContext(client as never)

    expect(client.rpc).toHaveBeenCalledWith('set_user_context', { p_nickname: '지훈' })
  })

  it('닉네임 없으면 이벤트 발행 → 설정 해소 대기 → 세션 마킹', async () => {
    const { local, session } = stubStorage()
    const win = stubWindow({ ready: true })
    win.addEventListener(NICKNAME_PROMPT_EVENT, (e) => {
      const detail = (e as CustomEvent<NicknamePromptDetail>).detail
      local.set('sportsday-nickname', '민수')
      detail.resolve()
    })
    const client = fakeClient()

    await ensureContext(client as never)

    expect(client.rpc).toHaveBeenCalledWith('set_user_context', { p_nickname: '민수' })
    expect(session.get('sportsday-nickname-prompted')).toBe('1')
  })

  it('건너뛰기(resolve만)도 세션 마킹 후 익명으로 진행', async () => {
    const { session } = stubStorage()
    const win = stubWindow({ ready: true })
    win.addEventListener(NICKNAME_PROMPT_EVENT, (e) => {
      ;(e as CustomEvent<NicknamePromptDetail>).detail.resolve()
    })
    const client = fakeClient()

    await ensureContext(client as never)

    expect(client.rpc).toHaveBeenCalledWith('set_user_context', { p_nickname: '익명' })
    expect(session.get('sportsday-nickname-prompted')).toBe('1')
  })

  it('대기 중 추가 호출은 같은 Promise를 재사용', async () => {
    stubStorage()
    const win = stubWindow({ ready: true })
    let release: (() => void) | null = null
    win.addEventListener(NICKNAME_PROMPT_EVENT, (e) => {
      release = (e as CustomEvent<NicknamePromptDetail>).detail.resolve
    })

    const first = requestNicknameViaProvider()
    const second = requestNicknameViaProvider()
    expect(first).toBe(second)

    release!()
    await first
  })
})

describe('닉네임 helpers 스토리지 방어', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('localStorage 접근이 throw하면 getNickname은 null, setNickname은 no-op', () => {
    const throwOnAccess = () => {
      throw new Error('The operation is insecure.')
    }
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: throwOnAccess,
      setItem: throwOnAccess,
    })

    expect(getNickname()).toBeNull()
    expect(() => setNickname('지훈')).not.toThrow()
  })
})
