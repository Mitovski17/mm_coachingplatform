'use client'

import { useState } from 'react'
import { suspendUser, unsuspendUser } from './actions'

export default function SuspendUserButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [pending, setPending] = useState(false)
  const [banned, setBanned] = useState(isBanned)

  async function handle() {
    setPending(true)
    const result = banned ? await unsuspendUser(userId) : await suspendUser(userId)
    if (result.ok) setBanned(!banned)
    setPending(false)
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: pending ? 'not-allowed' : 'pointer',
        border: 'none',
        backgroundColor: banned ? '#10b981' : '#ef4444',
        color: '#fff',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '...' : banned ? 'Unsuspend User' : 'Suspend User'}
    </button>
  )
}
