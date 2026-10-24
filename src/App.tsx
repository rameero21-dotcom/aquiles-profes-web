import { useCallback, useEffect, useRef, useState } from 'react'
import { buscar, getHoy, getLista, marcarPresente, puedeRegistrarse, supabase } from './api'
import type { Alumna, Clase, Hoy } from './api'

const TZ = 'America/Argentina/Buenos_Aires'
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
const titulo = (ymd?: string) => {
  if (!ymd) return ''
  const s = new Date(ymd + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const FEE: Record<string, string> = { al_dia: 'Cuota al día', vencida: 'Cuota vencida', sin_cuota: 'Sin cuota' }
const logo = `${import.meta.env.BASE_URL}logo.png`

type Msg = { ok: boolean; text: string } | null

export default function App() {
  const [session, setSession] = useState<boolean | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(Boolean(s)))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === null) return <div className="empty">Cargando…</div>
  return session ? <Profes /> : <Login />
}

function Login() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    const mail = email.trim()
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) setError(/confirm/i.test(error.message) ? 'Todavía no confirmaste tu email: abrí el mensaje que te mandamos y tocá el link.' : 'No pudimos ingresar: revisá el email y la contraseña.')
    } else {
      try {
        if (!(await puedeRegistrarse(mail))) { setError('Este email no está autorizado como profe. Pedile a recepción que te dé el acceso.'); setBusy(false); return }
        if (password.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres.'); setBusy(false); return }
        const { error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: window.location.origin + '/' } })
        if (error) setError(error.message)
        else setInfo('¡Listo! Te mandamos un email para confirmar tu cuenta. Abrilo (mirá también en spam), tocá el link y después ingresá con tu email y contraseña.')
      } catch (err) { setError((err as Error).message) }
    }
    setBusy(false)
  }
  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <img className="logo-big" src={logo} alt="Aquiles GYM" />
        <p className="sub" style={{ textAlign: 'center' }}>{modo === 'entrar' ? 'Ingreso de profes' : 'Crear mi cuenta de profe'}</p>
        {error && <div className="err">{error}</div>}
        {info && <div className="okmsg">{info}</div>}
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></div>
        <div className="field"><label>{modo === 'entrar' ? 'Contraseña' : 'Elegí una contraseña'}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} required /></div>
        <button className="btn full" disabled={busy}>{busy ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}</button>
        <button type="button" className="link" onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setError(''); setInfo('') }}>
          {modo === 'entrar' ? 'Primera vez: crear mi cuenta' : 'Ya tengo cuenta: ingresar'}
        </button>
      </form>
    </div>
  )
}

function Profes() {
  const [hoy, setHoy] = useState<Hoy | null>(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState('')
  const [msg, setMsg] = useState<Msg>(null)

  const cargar = useCallback(async () => {
    try { setHoy(await getHoy()); setError('') } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const aviso = (m: Msg) => { setMsg(m); window.setTimeout(() => setMsg(null), 6000) }

  if (error) return <div className="center"><div className="card login"><div className="err">{error}</div><button className="btn full" onClick={() => supabase.auth.signOut()}>Salir</button></div></div>
  if (!hoy) return <div className="empty">Cargando…</div>
  if (!hoy.ok) {
    return (
      <div className="center">
        <div className="card login">
          <img className="logo-big" src={logo} alt="Aquiles GYM" />
          <div className="err">Esta cuenta no tiene acceso de profe.</div>
          <p className="sub">Pedile a recepción que te dé el acceso con tu email.</p>
          <button className="btn full" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    )
  }
  const clases = hoy.classes ?? []
  return (
    <>
      <header className="top">
        <img className="logo" src={logo} alt="Aquiles GYM" />
        <span className="grow" />
        <span className="who">Hola, {hoy.name?.split(' ')[0]}</span>
        <button className="btn sec sm" onClick={() => supabase.auth.signOut()}>Salir</button>
      </header>
      <main className="main">
        <h1>Presentes de hoy</h1>
        <p className="sub">{titulo(hoy.today)} · tocá una clase para ver a las alumnas y marcar el presente</p>
        {msg && <div className={msg.ok ? 'okmsg' : 'err'}>{msg.text}</div>}
        {clases.length === 0 && <div className="empty">Hoy no hay clases.</div>}
        {clases.map(c => (
          <ClaseCard key={c.id} c={c} abierta={abierta === c.id} onToggle={() => setAbierta(abierta === c.id ? '' : c.id)} onAviso={aviso} onCambio={cargar} />
        ))}
      </main>
    </>
  )
}

function ClaseCard({ c, abierta, onToggle, onAviso, onCambio }: { c: Clase; abierta: boolean; onToggle: () => void; onAviso: (m: Msg) => void; onCambio: () => void }) {
  const [lista, setLista] = useState<Alumna[] | null>(null)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Alumna[]>([])
  const [busy, setBusy] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const cargarLista = useCallback(async () => {
    try { const r = await getLista(c.id); setLista(r.ok ? r.alumnas ?? [] : []); if (!r.ok) onAviso({ ok: false, text: r.reason ?? 'No se pudo ver la lista' }) } catch (e) { onAviso({ ok: false, text: (e as Error).message }) }
  }, [c.id, onAviso])
  useEffect(() => { if (abierta) cargarLista() }, [abierta, cargarLista])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (q.trim().length < 3) { setRes([]); return }
    timer.current = window.setTimeout(async () => {
      try { const r = await buscar(q); setRes(r.ok ? r.alumnas ?? [] : []) } catch { setRes([]) }
    }, 300)
    return () => window.clearTimeout(timer.current)
  }, [q])

  async function presente(a: Alumna) {
    setBusy(a.member_id)
    try {
      const r = await marcarPresente(c.id, a.member_id)
      onAviso({ ok: r.ok, text: (r.ok ? a.name + ': ' : 'No se registró el presente de ' + a.name + '. ') + (r.reason ?? '') })
      if (r.ok) { setQ(''); setRes([]); await cargarLista(); onCambio() }
    } catch (e) { onAviso({ ok: false, text: (e as Error).message }) }
    setBusy('')
  }

  const terminada = new Date(c.ends_at).getTime() < Date.now()
  return (
    <div className={'clase' + (c.mine ? ' mine' : '') + (abierta ? ' open' : '')}>
      <button className="clase-head" onClick={onToggle}>
        <span className="hora">{hora(c.starts_at)}</span>
        <span className="info">
          <b>{c.class}</b>
          <small>{c.instructor ?? 'Sin profe'}{terminada ? ' · finalizada' : ''}</small>
        </span>
        {c.mine && <span className="pill active">Tu clase</span>}
        <span className="cupo">{c.attended}/{c.booked}<small>presentes</small></span>
      </button>
      {abierta && (
        <div className="clase-body">
          <h3>Alumnas anotadas</h3>
          {lista === null && <div className="empty">Cargando…</div>}
          {lista && lista.length === 0 && <div className="empty">Todavía no hay alumnas anotadas.</div>}
          {lista?.map(a => (
            <div className="alu" key={a.member_id}>
              <span className="nom">{a.name}</span>
              {a.status === 'attended'
                ? <span className="pill active">✓ Presente</span>
                : <button className="btn sm" disabled={busy === a.member_id} onClick={() => presente(a)}>{busy === a.member_id ? '…' : 'Presente'}</button>}
            </div>
          ))}
          <h3 style={{ marginTop: 18 }}>Agregar una alumna que no está anotada</h3>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Escribí nombre o apellido (mínimo 3 letras)" autoComplete="off" />
          {res.map(a => (
            <div className="alu" key={a.member_id}>
              <span className="nom">{a.name}<small className={'fee ' + a.fee}>{FEE[a.fee ?? 'sin_cuota']}</small></span>
              <button className="btn sm" disabled={busy === a.member_id} onClick={() => presente(a)}>{busy === a.member_id ? '…' : 'Presente'}</button>
            </div>
          ))}
          {q.trim().length >= 3 && res.length === 0 && <div className="empty">No encontramos a nadie con ese nombre.</div>}
        </div>
      )}
    </div>
  )
}
