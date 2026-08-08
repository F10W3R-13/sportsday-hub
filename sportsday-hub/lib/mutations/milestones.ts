'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Milestone } from '@/lib/types/models'

export function useToggleMilestone() {
  const queryClient = useQueryClient()

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
    onMutate: async (milestone) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.milestones })
      const prev = queryClient.getQueryData<Milestone[]>(queryKeys.milestones)
      if (prev) {
        queryClient.setQueryData<Milestone[]>(
          queryKeys.milestones,
          prev.map((m) =>
            m.id === milestone.id ? { ...m, completed: !m.completed } : m
          )
        )
      }
      return { prev }
    },
    onError: (_err, _m, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.milestones, ctx.prev)
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
    },
  })
}
