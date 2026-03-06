import { supabase } from '@/lib/supabase/client'
import type { SystemInsert, SystemUpdate } from './types'

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
