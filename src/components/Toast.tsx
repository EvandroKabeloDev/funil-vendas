import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastValue = (msg: string, kind?: 'ok' | 'error') => void
const ToastContext = createContext<ToastValue>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null)

  const show = useCallback<ToastValue>((msg, kind = 'ok') => {
    setToast({ msg, kind })
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div className={`toast show ${toast.kind}`}>{toast.msg}</div>}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
