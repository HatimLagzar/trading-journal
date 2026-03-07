'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getSystems, createSystem, updateSystem, deleteSystem, getSubSystems, createSubSystem, updateSubSystem, deleteSubSystem, mergeSystems } from '@/services/system'
import type { System, SystemInsert, SubSystem, SubSystemInsert } from '@/services/system'
import type { User } from '@supabase/supabase-js'

export default function SystemsPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [subSystems, setSubSystems] = useState<SubSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [formData, setFormData] = useState<SystemInsert>({
    user_id: '',
    name: '',
    entry_rules: null,
    sl_rules: null,
    tp_rules: null,
    description: null,
  })
  const [saving, setSaving] = useState(false)

  // Merge systems modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [mergeSourceSystemId, setMergeSourceSystemId] = useState('')
  const [mergeTargetSystemId, setMergeTargetSystemId] = useState('')
  const [merging, setMerging] = useState(false)

  // Sub-system modal state
  const [isSubSystemModalOpen, setIsSubSystemModalOpen] = useState(false)
  const [selectedSubSystem, setSelectedSubSystem] = useState<SubSystem | null>(null)
  const [parentSystemId, setParentSystemId] = useState<string | null>(null)
  const [subSystemFormData, setSubSystemFormData] = useState<SubSystemInsert>({
    user_id: '',
    system_id: '',
    name: '',
    entry_rules: null,
    sl_rules: null,
    tp_rules: null,
    description: null,
  })

  async function refreshData() {
    if (!user) return
    try {
      const [systemsData, subSystemsData] = await Promise.all([
        getSystems(user.id),
        getSubSystems(user.id),
      ])
      setSystems(systemsData)
      setSubSystems(subSystemsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load systems')
    }
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
      try {
        const [systemsData, subSystemsData] = await Promise.all([
          getSystems(user.id),
          getSubSystems(user.id),
        ])
        setSystems(systemsData)
        setSubSystems(subSystemsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load systems')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function openCreateModal() {
    setSelectedSystem(null)
    setFormData({
      user_id: user?.id || '',
      name: '',
      entry_rules: null,
      sl_rules: null,
      tp_rules: null,
      description: null,
    })
    setIsModalOpen(true)
  }

  function openEditModal(system: System) {
    setSelectedSystem(system)
    setFormData({
      user_id: system.user_id,
      name: system.name,
      entry_rules: system.entry_rules,
      sl_rules: system.sl_rules,
      tp_rules: system.tp_rules,
      description: system.description,
    })
    setIsModalOpen(true)
  }

  function getSubSystemsForSystem(systemId: string): SubSystem[] {
    return subSystems.filter(s => s.system_id === systemId)
  }

  function openCreateSubSystemModal(systemId: string) {
    setParentSystemId(systemId)
    setSelectedSubSystem(null)
    setSubSystemFormData({
      user_id: user?.id || '',
      system_id: systemId,
      name: '',
      entry_rules: null,
      sl_rules: null,
      tp_rules: null,
      description: null,
    })
    setIsSubSystemModalOpen(true)
  }

  function openEditSubSystemModal(subSystem: SubSystem) {
    setParentSystemId(subSystem.system_id)
    setSelectedSubSystem(subSystem)
    setSubSystemFormData({
      user_id: subSystem.user_id,
      system_id: subSystem.system_id,
      name: subSystem.name,
      entry_rules: subSystem.entry_rules,
      sl_rules: subSystem.sl_rules,
      tp_rules: subSystem.tp_rules,
      description: subSystem.description,
    })
    setIsSubSystemModalOpen(true)
  }

  function closeSubSystemModal() {
    setIsSubSystemModalOpen(false)
    setSelectedSubSystem(null)
    setParentSystemId(null)
  }

  async function handleSubSystemSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      const data = { ...subSystemFormData, user_id: user.id }
      
      if (selectedSubSystem) {
        await updateSubSystem(selectedSubSystem.id, data)
      } else {
        await createSubSystem(data)
      }
      
      await refreshData()
      closeSubSystemModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sub-system')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSubSystem(subSystem: SubSystem) {
    if (!confirm(`Are you sure you want to delete "${subSystem.name}"?`)) {
      return
    }

    try {
      await deleteSubSystem(subSystem.id)
      await refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete sub-system')
    }
  }

  function updateSubSystemField<K extends keyof SubSystemInsert>(field: K, value: SubSystemInsert[K]) {
    setSubSystemFormData(prev => ({ ...prev, [field]: value }))
  }

  function closeModal() {
    setIsModalOpen(false)
    setSelectedSystem(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      const data = { ...formData, user_id: user.id }
      
      if (selectedSystem) {
        await updateSystem(selectedSystem.id, data)
      } else {
        await createSystem(data)
      }
      
      await refreshData()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save system')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(system: System) {
    if (!confirm(`Are you sure you want to delete "${system.name}"?`)) {
      return
    }

    try {
      await deleteSystem(system.id)
      await refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete system')
    }
  }

  function openMergeModal() {
    setMergeSourceSystemId('')
    setMergeTargetSystemId('')
    setIsMergeModalOpen(true)
  }

  function closeMergeModal() {
    if (merging) return
    setIsMergeModalOpen(false)
    setMergeSourceSystemId('')
    setMergeTargetSystemId('')
  }

  async function handleMergeSystems(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    if (!mergeSourceSystemId || !mergeTargetSystemId) {
      setError('Please select both source and target systems')
      return
    }

    if (mergeSourceSystemId === mergeTargetSystemId) {
      setError('Source and target systems must be different')
      return
    }

    const sourceName = systems.find((s) => s.id === mergeSourceSystemId)?.name ?? 'source system'
    const targetName = systems.find((s) => s.id === mergeTargetSystemId)?.name ?? 'target system'

    if (!confirm(`Merge "${sourceName}" into "${targetName}"? All trades from source will be moved and source system deleted.`)) {
      return
    }

    setMerging(true)
    setError(null)

    try {
      await mergeSystems(user.id, mergeSourceSystemId, mergeTargetSystemId)
      await refreshData()
      closeMergeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge systems')
    } finally {
      setMerging(false)
    }
  }

  function updateField<K extends keyof SystemInsert>(field: K, value: SystemInsert[K]) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trading Systems</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/trades')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Trades
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="flex gap-3">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add System
          </button>
          <button
            onClick={openMergeModal}
            disabled={systems.length < 2}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
          >
            Merge Systems
          </button>
        </div>
      </div>

      {systems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No systems yet. Create your first trading system!
        </div>
      ) : (
        <div className="grid gap-4">
          {systems.map((system) => (
            <div key={system.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{system.name}</h3>
                  {system.description && (
                    <p className="text-sm text-gray-600 mt-1">{system.description}</p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    {system.entry_rules && (
                      <div>
                        <span className="font-medium text-gray-500">Entry:</span>
                        <p className="text-gray-700">{system.entry_rules}</p>
                      </div>
                    )}
                    {system.sl_rules && (
                      <div>
                        <span className="font-medium text-gray-500">Stop Loss:</span>
                        <p className="text-gray-700">{system.sl_rules}</p>
                      </div>
                    )}
                    {system.tp_rules && (
                      <div>
                        <span className="font-medium text-gray-500">Take Profit:</span>
                        <p className="text-gray-700">{system.tp_rules}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => openCreateSubSystemModal(system.id)}
                    className="px-3 py-1 text-xs text-green-600 hover:text-green-800"
                  >
                    + Sub-System
                  </button>
                  <button
                    onClick={() => openEditModal(system)}
                    className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(system)}
                    className="px-3 py-1 text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Sub-systems */}
              <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sub-Systems</p>
                {getSubSystemsForSystem(system.id).length === 0 && (
                  <p className="text-sm text-gray-500">No sub-systems yet.</p>
                )}
                {getSubSystemsForSystem(system.id).map((subSystem) => (
                  <div key={subSystem.id} className="flex justify-between items-start bg-gray-50 p-2 rounded">
                    <div>
                      <span className="font-medium">{subSystem.name}</span>
                      {subSystem.entry_rules && (
                        <p className="text-xs text-gray-500 mt-1">Entry: {subSystem.entry_rules}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditSubSystemModal(subSystem)}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSubSystem(subSystem)}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedSystem ? 'Edit System' : 'Create System'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  System Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                  placeholder="e.g., Breakout Strategy"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value || null)}
                  rows={2}
                  placeholder="Brief description of the system..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Entry Rules</label>
                <textarea
                  value={formData.entry_rules || ''}
                  onChange={(e) => updateField('entry_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for entering a trade..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stop Loss Rules</label>
                <textarea
                  value={formData.sl_rules || ''}
                  onChange={(e) => updateField('sl_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for setting stop loss..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Take Profit Rules</label>
                <textarea
                  value={formData.tp_rules || ''}
                  onChange={(e) => updateField('tp_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for taking profit..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : selectedSystem ? 'Update System' : 'Create System'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-System Modal */}
      {isSubSystemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedSubSystem ? 'Edit Sub-System' : 'Create Sub-System'}
              </h2>
              <button onClick={closeSubSystemModal} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubSystemSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sub-System Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subSystemFormData.name}
                  onChange={(e) => updateSubSystemField('name', e.target.value)}
                  required
                  placeholder="e.g., Trend Follow"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={subSystemFormData.description || ''}
                  onChange={(e) => updateSubSystemField('description', e.target.value || null)}
                  rows={2}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Entry Rules</label>
                <textarea
                  value={subSystemFormData.entry_rules || ''}
                  onChange={(e) => updateSubSystemField('entry_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for entering..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stop Loss Rules</label>
                <textarea
                  value={subSystemFormData.sl_rules || ''}
                  onChange={(e) => updateSubSystemField('sl_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for stop loss..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Take Profit Rules</label>
                <textarea
                  value={subSystemFormData.tp_rules || ''}
                  onChange={(e) => updateSubSystemField('tp_rules', e.target.value || null)}
                  rows={2}
                  placeholder="Rules for take profit..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : selectedSubSystem ? 'Update Sub-System' : 'Create Sub-System'}
                </button>
                <button
                  type="button"
                  onClick={closeSubSystemModal}
                  disabled={saving}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Systems Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Merge Systems</h2>
              <button onClick={closeMergeModal} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleMergeSystems} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source System (will be deleted)</label>
                <select
                  value={mergeSourceSystemId}
                  onChange={(e) => setMergeSourceSystemId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select source system</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>{system.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target System (will keep trades)</label>
                <select
                  value={mergeTargetSystemId}
                  onChange={(e) => setMergeTargetSystemId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select target system</option>
                  {systems
                    .filter((system) => system.id !== mergeSourceSystemId)
                    .map((system) => (
                      <option key={system.id} value={system.id}>{system.name}</option>
                    ))}
                </select>
              </div>

              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                This moves all trades from source to target and deletes the source system.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={merging}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {merging ? 'Merging...' : 'Merge Systems'}
                </button>
                <button
                  type="button"
                  onClick={closeMergeModal}
                  disabled={merging}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
