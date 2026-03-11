'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthNavbar from '@/app/components/AuthNavbar'
import { supabase } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [loadingUser, setLoadingUser] = useState(true)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      setLoadingUser(false)
    }

    void ensureAuthenticated()
  }, [router])

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
      </div>
    </div>
  )
}
