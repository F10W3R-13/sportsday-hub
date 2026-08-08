'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { TeamId, IssueStatus } from '@/lib/types/models'

type IssueUpdate = {
  status?: IssueStatus
  title?: string
}

export function useAddIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      teamId: TeamId | null
      title: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('issues')
        .insert({
          team_id: input.teamId,
          title: input.title,
          status: 'open',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      toast.success('이슈가 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패.'),
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      status?: IssueStatus
      title?: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const update: IssueUpdate = {}
      if (input.status !== undefined) update.status = input.status
      if (input.title !== undefined) update.title = input.title
      const { error } = await client
        .from('issues')
        .update(update)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
    },
    onError: () => toast.error('저장 실패.'),
  })
}

export function useDeleteIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('issues')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      toast.success('이슈가 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패.'),
  })
}
