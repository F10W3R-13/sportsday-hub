'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'

export function useUpdateGuidelineSection() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: {
      teamId: string
      sectionId: string
      contentMd: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      // C3: 클라이언트에서 read-modify-write(전체 guideline_doc 덮어쓰기)하면
      // 동시 편집 시 섹션 유실이 발생하므로 서버 RPC로 원자적 갱신.
      const { error } = await client.rpc('update_guideline_section', {
        p_team_id: input.teamId,
        p_section_id: input.sectionId,
        p_content_md: input.contentMd,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams })
      void router.refresh()
      toast.success('지침이 저장되었습니다.')
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
