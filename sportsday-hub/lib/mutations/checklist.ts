'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { ChecklistItem, TeamId } from '@/lib/types/models'

// ===== 체크 토글 =====
export function useToggleCheck() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (item: ChecklistItem) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('checklist_items')
        .update({ completed: !item.completed })
        .eq('id', item.id)
      if (error) throw error
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      void router.refresh()
    },
  })
}

// ===== 항목 추가 =====
export function useAddChecklistItem() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: {
      teamId: TeamId
      section: ChecklistItem['section']
      content: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('checklist_items')
        .insert({
          team_id: input.teamId,
          section: input.section,
          content: input.content,
          completed: false,
          // 기존 항목(0~100 범위) 뒤에 정렬되도록 충분히 큰 값 사용.
          // 정적 상수(999) 대신 타임스탬프 기반으로 변경해 동시 추가 시 충돌을 방지.
          sort_order: Math.floor(Date.now() / 1000) % 100000,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      void router.refresh()
      toast.success('항목이 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 삭제 (soft-delete) =====
export function useDeleteChecklistItem() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('checklist_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      void router.refresh()
      toast.success('항목이 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
