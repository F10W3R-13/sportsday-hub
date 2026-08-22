'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Handoff, TeamId } from '@/lib/types/models'

export interface HandoffInput {
  fromTeamId: TeamId
  toTeamId: TeamId | null
  toExternal: string | null
  title: string
  dueDate: string | null
  itemId: string | null
}

// ===== 등록 =====
export function useCreateHandoff() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: HandoffInput) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client.from('handoffs').insert({
        from_team_id: input.fromTeamId,
        to_team_id: input.toTeamId,
        to_external: input.toExternal,
        title: input.title,
        due_date: input.dueDate,
        item_id: input.itemId,
        completed: false,
        sort_order: Math.floor(Date.now() / 1000) % 100000,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handoffs })
      void router.refresh()
      toast.success('인계가 등록되었습니다.')
    },
    onError: () => toast.error('등록 실패. 다시 시도해주세요.'),
  })
}

// ===== 편집 =====
export function useUpdateHandoff() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async ({ id, ...input }: HandoffInput & { id: string }) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('handoffs')
        .update({
          from_team_id: input.fromTeamId,
          to_team_id: input.toTeamId,
          to_external: input.toExternal,
          title: input.title,
          due_date: input.dueDate,
          item_id: input.itemId,
          // DB에 updated_at 자동갱신 트리거가 없어 명시 갱신 — 수정 시점 기준으로 기록.
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handoffs })
      void router.refresh()
      toast.success('인계가 수정되었습니다.')
    },
    onError: () => toast.error('수정 실패. 다시 시도해주세요.'),
  })
}

// ===== 완료 토글 =====
export function useToggleHandoff() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (handoff: Handoff) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('handoffs')
        .update({
          completed: !handoff.completed,
          // DB에 updated_at 자동갱신 트리거가 없어 명시 갱신 — 완료 정렬이 updated_at 내림차순이므로 토글 시각을 반영해야 함.
          updated_at: new Date().toISOString(),
        })
        .eq('id', handoff.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handoffs })
      void router.refresh()
    },
    onError: () => toast.error('상태 변경 실패. 다시 시도해주세요.'),
  })
}

// ===== 소프트삭제 =====
export function useDeleteHandoff() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('handoffs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handoffs })
      void router.refresh()
      toast.success('인계가 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
