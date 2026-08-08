'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Decision, DecisionStatus } from '@/lib/types/models'

type DecisionUpdate = {
  status?: DecisionStatus
  current_value?: string | null
  notes?: string | null
}

export function useUpdateDecision() {
  const queryClient = useQueryClient()

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.decisions })
      const prev = queryClient.getQueryData<Decision[]>(queryKeys.decisions)
      if (prev) {
        queryClient.setQueryData<Decision[]>(
          queryKeys.decisions,
          prev.map((d) =>
            d.id === input.id
              ? {
                  ...d,
                  status: input.status ?? d.status,
                  current_value: input.currentValue ?? d.current_value,
                  notes: input.notes ?? d.notes,
                }
              : d
          )
        )
      }
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.decisions, ctx.prev)
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions })
    },
  })
}
