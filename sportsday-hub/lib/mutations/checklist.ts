'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import { notifyTabs } from '@/lib/sync'
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
    onSuccess: () => {
      // 체크박스 자체는 낙관적 UI로 즉시 뒤집히지만, 마일스톤별 진행률(1/4)과
      // 상단 진행 바를 서버 데이터와 동기화하려면 캐시 무효화 + 라우트 새로고침이 필요.
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      notifyTabs({ type: 'checklist-updated' })
      void router.refresh()
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 추가 =====
export function useAddChecklistItem() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: {
      teamId: TeamId
      milestoneId: string | null
      content: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('checklist_items')
        .insert({
          team_id: input.teamId,
          milestone_id: input.milestoneId,
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
      notifyTabs({ type: 'checklist-updated' })
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
      notifyTabs({ type: 'checklist-updated' })
      void router.refresh()
      toast.success('항목이 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
