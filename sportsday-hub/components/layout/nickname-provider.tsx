'use client'

import { useState, useCallback, createContext, useContext } from 'react'
import { NicknameDialog } from './nickname-dialog'

const NicknameContext = createContext<() => void>(() => {})

export function NicknameProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false)

  const requestNickname = useCallback(() => {
    setShowDialog(true)
  }, [])

  return (
    <NicknameContext.Provider value={requestNickname}>
      {children}
      <NicknameDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </NicknameContext.Provider>
  )
}

export function useNicknamePrompt() {
  return useContext(NicknameContext)
}
