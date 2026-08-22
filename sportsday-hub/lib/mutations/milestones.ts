'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import { notifyTabs } from '@/lib/sync'
import type { Milestone, MilestoneCategory, Priority } from '@/lib/types/models'

// ===== 완료 토글 =====
export function useToggleMilestone() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (milestone: Milestone) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('milestones')
        .update({ completed: !milestone.completed })
        .eq('id', milestone.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
      notifyTabs({ type: 'tasks-updated' })
      void router.refresh()
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 생성 =====
export function useCreateMilestone() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: {
      teamId: string | null
      title: string
      date?: string | null
      category?: MilestoneCategory
      priority?: Priority
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('milestones')
        .insert({
          team_id: input.teamId,
          title: input.title,
          ...(input.date !== undefined ? { date: input.date } : {}),
          // 미지정 시 DB 기본값('deliverable')에 위임
          ...(input.category ? { category: input.category } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
      notifyTabs({ type: 'tasks-updated' })
      void router.refresh()
      toast.success('항목이 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 삭제 (soft-delete) =====
export function useDeleteMilestone() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('milestones')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
      notifyTabs({ type: 'tasks-updated' })
      void router.refresh()
      toast.success('항목이 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
