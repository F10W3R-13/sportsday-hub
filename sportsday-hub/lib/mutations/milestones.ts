'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import type { Milestone } from '@/lib/types/models'

export function useToggleMilestone() {
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
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
