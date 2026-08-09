'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import { notifyTabs } from '@/lib/sync'
import type { DecisionStatus } from '@/lib/types/models'

type DecisionUpdate = {
  status?: DecisionStatus
  current_value?: string | null
  notes?: string | null
}

export function useUpdateDecision() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: {
      id: string
      status?: DecisionStatus
      currentValue?: string
      notes?: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const update: DecisionUpdate = {}
      if (input.status !== undefined) update.status = input.status
      if (input.currentValue !== undefined) update.current_value = input.currentValue
      if (input.notes !== undefined) update.notes = input.notes
      const { data, error } = await client
        .from('decisions')
        .update(update)
        .eq('id', input.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions })
      notifyTabs({ type: 'decision-updated' })
      void router.refresh()
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
