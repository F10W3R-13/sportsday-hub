'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Team } from '@/lib/types/models'

export function useUpdateGuidelineSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      teamId: string
      sectionId: string
      contentMd: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      // 현재 팀 데이터 조회 → 섹션 업데이트 → 저장
      const { data: team, error: fetchErr } = await client
        .from('teams')
        .select('*')
        .eq('id', input.teamId as Team['id'])
        .single()
      if (fetchErr) throw fetchErr
      if (!team) throw new Error('팀을 찾을 수 없습니다')

      const sections = (team.guideline_doc?.sections ?? []).map((s) =>
        s.id === input.sectionId
          ? { ...s, content_md: input.contentMd }
          : s
      )
      const { error } = await client
        .from('teams')
        .update({
          guideline_doc: { sections },
        })
        .eq('id', input.teamId as Team['id'])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams })
      toast.success('지침이 저장되었습니다.')
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
