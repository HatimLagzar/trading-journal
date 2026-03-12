'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthNavbar from '@/app/components/AuthNavbar'
import { supabase } from '@/lib/supabase/client'

type AdminInvite = {
  id: string
  created_at: string
  expires_at: string | null
  grants_days: number
  used_at: string | null
  used_by: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [loadingUser, setLoadingUser] = useState(true)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [invitesError, setInvitesError] = useState<string | null>(null)
  const [invites, setInvites] = useState<AdminInvite[]>([])
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)

  useEffect(() => {
    async function ensureAuthenticated() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email ?? '')
      await loadAdminInvites()
      setLoadingUser(false)
    }

    void ensureAuthenticated()
  }, [router])

  async function loadAdminInvites() {
    setInvitesLoading(true)
    setInvitesError(null)

    try {
      const response = await fetch('/api/admin/invites', {
        method: 'GET',
      })

      if (response.status === 403) {
        setIsAdmin(false)
        setInvites([])
        return
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? 'Failed to load invites')
      }

      const payload = (await response.json()) as { invites?: AdminInvite[] }
      setIsAdmin(true)
      setInvites(payload.invites ?? [])
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to load invites')
    } finally {
      setInvitesLoading(false)
    }
  }

  async function handleGenerateInvite() {
    setCreatingInvite(true)
    setInvitesError(null)
    setGeneratedInviteUrl(null)

    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
      })

      const payload = (await response.json()) as {
        inviteUrl?: string
        invite?: AdminInvite
        error?: string
      }

      if (!response.ok || !payload.inviteUrl || !payload.invite) {
        throw new Error(payload.error ?? 'Failed to create invite')
      }

      setGeneratedInviteUrl(payload.inviteUrl)
      setInvites((prev) => [payload.invite as AdminInvite, ...prev])
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setCreatingInvite(false)
    }
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setSuccess('Invite link copied')
    } catch {
      setInvitesError('Failed to copy invite link')
    }
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (loadingUser) {
    return <div className="p-8">Loading settings...</div>
  }

  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <AuthNavbar current="settings" />

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Account settings</h1>
          <p className="mt-2 text-sm text-slate-600">Update your account password.</p>

          <div className="mt-4 max-w-md">
            <label htmlFor="account-email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="account-email"
              type="email"
              value={email}
              disabled
              readOnly
              className="w-full cursor-not-allowed rounded-lg border bg-slate-100 px-3 py-2 text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-500">Email address cannot be changed from this page.</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="mt-6 max-w-md space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter new password"
              />
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>

        </div>

        {isAdmin && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Invite links</h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate single-use invite links. Trial duration uses INVITE_PREMIUM_DAYS (default 2).
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={creatingInvite}
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {creatingInvite ? 'Generating...' : 'Generate invite'}
              </button>
              <button
                type="button"
                onClick={loadAdminInvites}
                disabled={invitesLoading}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {invitesLoading ? 'Refreshing...' : 'Refresh list'}
              </button>
            </div>

            {generatedInviteUrl && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">New invite link generated</p>
                <p className="mt-1 break-all">{generatedInviteUrl}</p>
                <button
                  type="button"
                  onClick={() => copyInvite(generatedInviteUrl)}
                  className="mt-2 cursor-pointer rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Copy link
                </button>
              </div>
            )}

            {invitesError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {invitesError}
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-2 font-semibold">Created</th>
                    <th className="px-3 py-2 font-semibold">Trial days</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Used by</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-slate-100 text-slate-700">
                      <td className="px-3 py-2">{formatDateTime(invite.created_at)}</td>
                      <td className="px-3 py-2">{invite.grants_days}</td>
                      <td className="px-3 py-2">{getInviteStatus(invite)}</td>
                      <td className="px-3 py-2">{invite.used_by ?? '-'}</td>
                    </tr>
                  ))}
                  {invites.length === 0 && !invitesLoading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500">
                        No invites generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getInviteStatus(invite: AdminInvite): string {
  if (invite.used_at) return 'Used'
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return 'Expired'
  }

  return 'Active'
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}
