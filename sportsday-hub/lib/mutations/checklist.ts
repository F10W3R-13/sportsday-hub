'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { ChecklistItem, TeamId } from '@/lib/types/models'

// ===== 체크 토글 (낙관적 업데이트) =====
export function useToggleCheck() {
  const queryClient = useQueryClient()

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
    onMutate: async (item) => {
      // 통합 체크리스트와 팀 체크리스트 모두 무효화
      await queryClient.cancelQueries({ queryKey: queryKeys.checklist })
      const prevAll = queryClient.getQueryData<ChecklistItem[]>(queryKeys.checklist)
      if (prevAll) {
        queryClient.setQueryData<ChecklistItem[]>(
          queryKeys.checklist,
          prevAll.map((i) =>
            i.id === item.id ? { ...i, completed: !i.completed } : i
          )
        )
      }
      return { prevAll }
    },
    onError: (_err, _item, ctx) => {
      if (ctx?.prevAll) {
        queryClient.setQueryData(queryKeys.checklist, ctx.prevAll)
      }
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
    },
  })
}

// ===== 항목 추가 =====
export function useAddChecklistItem() {
  const queryClient = useQueryClient()

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
          sort_order: 999,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      toast.success('항목이 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 삭제 (soft-delete) =====
export function useDeleteChecklistItem() {
  const queryClient = useQueryClient()

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
      toast.success('항목이 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
