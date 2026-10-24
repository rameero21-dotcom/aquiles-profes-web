import { createClient } from '@supabase/supabase-js'

// Clave pública (la misma que usan el panel y la web de socias): solo sirve junto con el ingreso de una profe autorizada.
export const supabase = createClient('https://cwlliaswhntqghsbmcqb.supabase.co', 'sb_publishable_MPZDNiB-U8UZNUctrW21Pw_qM8_IcUR', {
  auth: { storageKey: 'aquiles-profes-auth' },
})

export interface Clase {
  id: string; class: string; starts_at: string; ends_at: string; instructor: string | null
  capacity: number; booked: number; attended: number; mine: boolean
}
export interface Hoy { ok: boolean; reason?: string; name?: string; today?: string; classes?: Clase[] }
export interface Alumna { member_id: string; name: string; status?: 'booked' | 'attended' | 'no_show'; fee?: 'al_dia' | 'vencida' | 'sin_cuota' }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const getHoy = () => rpc<Hoy>('teacher_today')
export const getLista = (event: string) => rpc<{ ok: boolean; reason?: string; alumnas?: Alumna[] }>('teacher_roster', { p_event: event })
export const buscar = (q: string) => rpc<{ ok: boolean; reason?: string; alumnas?: Alumna[] }>('teacher_find_members', { p_q: q })
export const marcarPresente = (event: string, member: string) => rpc<{ ok: boolean; reason?: string }>('mark_attendance', { p_event: event, p_member: member })
