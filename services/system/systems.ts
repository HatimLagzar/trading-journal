import { supabase } from '@/lib/supabase/client'
import type { SystemInsert, SystemUpdate, SubSystemInsert, SubSystemUpdate } from './types'

export async function getSystems(userId: string) {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getSystem(id: string) {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createSystem(system: SystemInsert) {
  const { data, error } = await supabase
    .from('systems')
    .insert(system)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSystem(id: string, updates: SystemUpdate) {
  const { data, error } = await supabase
    .from('systems')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSystem(id: string) {
  const { error } = await supabase
    .from('systems')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getSubSystems(userId: string, systemId?: string) {
  let query = supabase
    .from('sub_systems')
    .select('*')
    .eq('user_id', userId)

  if (systemId) {
    query = query.eq('system_id', systemId)
  }

  const { data, error } = await query.order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getSubSystem(id: string) {
  const { data, error } = await supabase
    .from('sub_systems')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createSubSystem(subSystem: SubSystemInsert) {
  const { data, error } = await supabase
    .from('sub_systems')
    .insert(subSystem)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSubSystem(id: string, updates: SubSystemUpdate) {
  const { data, error } = await supabase
    .from('sub_systems')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSubSystem(id: string) {
  const { error } = await supabase
    .from('sub_systems')
    .delete()
    .eq('id', id)

  if (error) throw error
}
