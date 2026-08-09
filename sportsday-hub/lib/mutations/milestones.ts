'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import { notifyTabs } from '@/lib/sync'
import type { Milestone } from '@/lib/types/models'

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
      notifyTabs({ type: 'milestone-updated' })
      void router.refresh()
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
