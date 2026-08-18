'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { setNickname } from '@/lib/supabase/client'

export function NicknameDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [value, setValue] = useState('')

  const handleSave = () => {
    const name = value.trim()
    if (name) {
      setNickname(name)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>닉네임을 입력해주세요</DialogTitle>
          <DialogDescription>
            편집 시 누가 변경했는지 기록하는 데 사용됩니다. 건너뛰면 &apos;익명&apos;으로 기록돼요.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="예: 지훈"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            건너뛰기
          </Button>
          <Button onClick={handleSave} disabled={!value.trim()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
