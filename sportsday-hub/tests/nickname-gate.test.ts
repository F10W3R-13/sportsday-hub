import { describe, it, expect } from 'vitest'
import { shouldPromptNickname } from '@/lib/supabase/client'
import type { NicknameGateInput } from '@/lib/supabase/client'

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
