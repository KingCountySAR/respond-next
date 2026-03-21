import { useEffect, useRef } from 'react'
import { AuthStore } from '../store/authStore'
import { observer } from 'mobx-react-lite'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (el: HTMLElement, config: object) => void
        }
      }
    }
  }
}

export const LoginButton = observer(({ store }: { store: AuthStore }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      store.setupButton(ref.current)
    }
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center'}}>
      <div ref={ref} id="google-signin-btn" /> {store.working ? '...' : ''}
    </div>
  )
})