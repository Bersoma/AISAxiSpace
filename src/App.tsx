import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

type Row = { id: string; full_name: string; grade: number; division: string; total: number; activities_done: number; grade_rank: number; division_rank: number }
type Act = { id: string; name: string; description: string | null; category: string | null; max_score: number; grades: number[] }
type Filter = { grade?: number; division?: 'Lower' | 'Upper' }

const ord = (n: number) => (n === 1 ? '1st Place' : n === 2 ? '2nd Place' : n === 3 ? '3rd Place' : String(n))

function useRoute() {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h.replace(/^#/, '')
}

// Public data is polled every 5s (public visitors cannot read the raw scores table, so Realtime is not used for them).
function useBoard(f: Filter, limit?: number) {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    const load = async () => {
      let q = supabase.from('leaderboard').select('*')
      if (f.grade) q = q.eq('grade', f.grade)
      if (f.division) q = q.eq('division', f.division)
      const { data, error } = await q.order('total', { ascending: false }).order('full_name').limit(limit ?? 500)
      if (!live) return
      if (error) setErr(error.message); else { setErr(''); setRows((data as Row[]) ?? []) }
    }
    load(); const t = setInterval(load, 5000)
    return () => { live = false; clearInterval(t) }
  }, [f.grade, f.division, limit])
  return { rows, err }
}

function Board({ f, limit }: { f: Filter; limit?: number }) {
  const { rows, err } = useBoard(f, limit)
  const pos = (r: Row) => (f.grade ? r.grade_rank : f.division ? r.division_rank : 0)
  const all = !f.grade && !f.division
  const ranked = all ? rows.map((r, i) => ({ r, p: i > 0 && rows[i - 1].total === r.total ? 0 : i + 1 })) : rows.map(r => ({ r, p: pos(r) }))
  let last = 0
  const out = ranked.map(x => { if (all) { if (x.p) last = x.p; return { ...x, p: last } } return x })
  return <div className="box">{err && <p className="err" style={{ padding: 12 }}>{err}</p>}
    <table><thead><tr><th>Position</th><th>Student</th><th>Grade</th><th className="n">Points</th></tr></thead><tbody>
      {out.map(({ r, p }) => <tr key={r.id} className={p <= 3 ? 'p' + p : ''}><td><span className="pos">{ord(p)}</span></td><td><b>{r.full_name}</b></td><td>Grade {r.grade}</td><td className="n"><b>{r.total}</b></td></tr>)}
      {!out.length && !err && <tr><td colSpan={4} className="muted">No scores yet. Rankings appear as soon as the first score is saved.</td></tr>}
    </tbody></table></div>
}

function Nav({ route }: { route: string }) {
  const L = (to: string, t: string) => <a className={'l' + (route === to ? ' on' : '')} href={'#' + to}>{t}</a>
  return <nav><div className="wrap"><img src="robospace.png" alt="RoboSpace Academy" /><img src="aisa.png" alt="AISA" /><span className="sp" />
    {L('/', 'Home')}{L('/activities', 'Activities')}{L('/lower', 'Lower Grade')}{L('/upper', 'Upper Grade')}{L('/grade/2', 'Leaderboards')}{L('/winners', 'Winners')}{L('/judge', 'Admin Login')}</div></nav>
}

function Home() {
  const [s, setS] = useState<any>({}); const [acts, setActs] = useState<Act[]>([]); const [set, setSet] = useState<Record<string, string>>({})
  useEffect(() => {
    const go = async () => { const a = await supabase.from('public_stats').select('*').single(); if (a.data) setS(a.data) }
    go(); const t = setInterval(go, 5000)
    supabase.from('activities').select('*').eq('active', true).order('category').then(r => setActs((r.data as Act[]) ?? []))
    supabase.from('settings').select('*').then(r => setSet(Object.fromEntries((r.data ?? []).map((x: any) => [x.key, x.value]))))
    return () => clearInterval(t)
  }, [])
  return <>
    <header className="hero"><div className="wrap">
      <h1>ROBOPARTY 2026</h1><p><span className="pill">Explore the Future with Robots &amp; AI</span></p>
      <p className="muted" style={{ maxWidth: 560, margin: '14px auto', fontSize: 18 }}>Discover an exciting world of robotics, artificial intelligence, technology and friendly competition.</p>
      <b>Saturday, 21 November 2026 · 10:00 AM - 2:00 PM</b>{set.venue && <div>{set.venue}</div>}
      <div className="row"><a className="btn" href="#/grade/2">View Live Leaderboard</a><a className="btn b" href="#/activities">Explore Activities</a></div></div></header>
    <div className="wrap">
      <div className="grid">{[['Students', s.students], ['Activities', s.activities], ['Scores recorded', s.scores], ['Grades', s.grades]].map(([k, v]) => <div className="stat" key={k as string}><b>{v ?? 0}</b>{k}</div>)}</div>
      <div className="grid"><a className="card blue" href="#/lower"><h2>Lower Grade</h2>Grade 2 and Grade 3</a><a className="card orange" href="#/upper"><h2>Upper Grade</h2>Grade 4 and Grade 5</a></div>
      <h2 className="s">Top five right now</h2><Board f={{}} limit={5} />
      <h2 className="s">Activities</h2><Acts acts={acts} />
      <h2 className="s">Prizes</h2>
      <div className="grid"><div className="card green"><h3>Drone</h3></div><div className="card blue"><h3>Basic Robotics Starter Kit</h3></div>
        <div className="card orange"><h3>Recognition</h3>Creativity and teamwork</div></div>
    </div><footer className="wrap">Organised by RoboSpace Academy in collaboration with AISA. Fee: ₦30,000.</footer></>
}

function Acts({ acts }: { acts: Act[] }) {
  return <div className="grid">{acts.map(a => <div key={a.id} className={'card ' + (a.category === 'Robo Fun' ? 'green' : 'orange')}><h3>{a.name}</h3>{a.description}<div style={{ opacity: .85, marginTop: 8, fontSize: 13 }}>{a.category}</div></div>)}</div>
}
function ActivitiesPage() {
  const [acts, setActs] = useState<Act[]>([])
  useEffect(() => { supabase.from('activities').select('*').eq('active', true).order('category').then(r => setActs((r.data as Act[]) ?? [])) }, [])
  return <div className="wrap"><h2 className="s">Activities</h2><Acts acts={acts} /></div>
}

function Tabs({ route }: { route: string }) {
  const t: [string, string][] = [['/grade/2', 'Grade 2'], ['/grade/3', 'Grade 3'], ['/grade/4', 'Grade 4'], ['/grade/5', 'Grade 5'], ['/lower', 'Lower Grade Overall'], ['/upper', 'Upper Grade Overall']]
  return <div className="row" style={{ justifyContent: 'flex-start' }}>{t.map(([to, n]) => <a key={to} href={'#' + to} className={'btn ' + (route === to ? 'b' : 'g')}>{n}</a>)}</div>
}
function Winners() {
  const [w, setW] = useState<any[]>([])
  useEffect(() => { supabase.from('public_winners').select('*').then(r => setW(r.data ?? [])) }, [])
  return <div className="wrap"><h2 className="s">Winners and recognition</h2>
    {w.length ? <div className="box"><table><thead><tr><th>Category</th><th>Student</th><th>Grade</th><th>Prize</th></tr></thead><tbody>
      {w.map(x => <tr key={x.id}><td>{x.category}</td><td><b>{x.full_name}</b></td><td>{x.grade ? 'Grade ' + x.grade : ''}</td><td>{x.prize ?? ''}</td></tr>)}</tbody></table></div>
      : <p className="muted">Winners will appear here once results are approved and published.</p>}</div>
}

const SLIDES: [string, Filter][] = [['Grade 2', { grade: 2 }], ['Grade 3', { grade: 3 }], ['Grade 4', { grade: 4 }], ['Grade 5', { grade: 5 }], ['Lower Grade Overall', { division: 'Lower' }], ['Upper Grade Overall', { division: 'Upper' }]]
function Display() {
  const [i, setI] = useState(0); const [auto, setAuto] = useState(true)
  useEffect(() => { if (!auto) return; const t = setInterval(() => setI(x => (x + 1) % SLIDES.length), 12000); return () => clearInterval(t) }, [auto])
  const fs = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
  return <div className="disp"><div className="top"><span className="chip"><img src="robospace.png" alt="RoboSpace" /></span><span className="chip"><img src="aisa.png" alt="AISA" /></span>
    <div><h1>ROBOPARTY 2026</h1><div style={{ fontSize: 24, color: '#f9a66b', fontWeight: 800 }}>{SLIDES[i][0]}</div></div></div>
    <div className="ctl">{SLIDES.map((s, k) => <button key={s[0]} className={k === i ? 'on' : ''} onClick={() => { setI(k); setAuto(false) }}>{s[0]}</button>)}
      <button onClick={() => setAuto(!auto)}>{auto ? 'Pause rotation' : 'Auto-rotate'}</button><button onClick={fs}>Full screen</button></div>
    <Board f={SLIDES[i][1]} limit={10} /></div>
}

function Judge() {
  const [user, setUser] = useState<any>(null); const [role, setRole] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState('')
  const [acts, setActs] = useState<Act[]>([]); const [act, setAct] = useState<Act | null>(null)
  const [studs, setStuds] = useState<any[]>([]); const [saved, setSaved] = useState<Record<string, number>>({}); const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => { supabase.auth.getSession().then(r => setUser(r.data.session?.user ?? null)) }, [])
  useEffect(() => { if (!user) return
    supabase.from('staff').select('role').eq('user_id', user.id).maybeSingle().then(async r => { setRole(r.data?.role ?? '')
      if (!r.data) return
      if (r.data.role === 'admin') { const a = await supabase.from('activities').select('*').eq('active', true).order('name'); setActs((a.data as Act[]) ?? []) }
      else { const a = await supabase.from('judge_assignments').select('activities(*)').eq('user_id', user.id); setActs((a.data ?? []).map((x: any) => x.activities).filter((x: Act) => x)) } })
  }, [user])
  const load = useCallback(async (a: Act) => {
    setAct(a); setDraft({})
    const s = await supabase.from('students').select('*').in('grade', a.grades).order('grade').order('full_name'); setStuds(s.data ?? [])
    const c = await supabase.from('scores').select('student_id,score').eq('activity_id', a.id); setSaved(Object.fromEntries((c.data ?? []).map((x: any) => [x.student_id, Number(x.score)])))
  }, [])
  const [all, setAll] = useState<any[]>([]); const [nm, setNm] = useState(''); const [gr, setGr] = useState('2'); const [note, setNote] = useState('')
  const loadAll = useCallback(async () => { const r = await supabase.from('students').select('*').order('grade').order('full_name'); setAll(r.data ?? []) }, [])
  useEffect(() => { if (role === 'admin') loadAll() }, [role, loadAll])
  const addStudent = async () => {
    if (!nm.trim()) return setNote('Enter the student name.')
    const r = await supabase.from('students').insert({ full_name: nm.trim(), grade: Number(gr) })
    if (r.error) return setNote(r.error.message)
    setNote('Added ' + nm.trim() + ' (Grade ' + gr + ').'); setNm(''); loadAll(); if (act) load(act)
  }
  const removeStudent = async (st: any) => {
    if (!confirm('Delete ' + st.full_name + ' and all their scores?')) return
    const r = await supabase.from('students').delete().eq('id', st.id)
    if (r.error) setNote(r.error.message); else { loadAll(); if (act) load(act) }
  }
  const login = async () => { const r = await supabase.auth.signInWithPassword({ email, password: pw }); if (r.error) setMsg(r.error.message); else setUser(r.data.user) }
  const save = async () => {
    if (!act) return; const rows: any[] = []; const bad: string[] = []
    for (const [sid, v] of Object.entries(draft)) { if (v.trim() === '') continue; const n = Number(v); if (isNaN(n) || n < 0 || n > act.max_score) bad.push(studs.find(s => s.id === sid)?.full_name); else rows.push({ student_id: sid, activity_id: act.id, score: n }) }
    if (bad.length) return setMsg('Fix scores (0 to ' + act.max_score + ') for: ' + bad.join(', '))
    const r = await supabase.from('scores').upsert(rows, { onConflict: 'student_id,activity_id' })
    if (r.error) setMsg(r.error.message); else { setMsg('Saved ' + rows.length + ' score(s).'); load(act) }
  }
  if (!user) return <div className="wrap"><h2 className="s">Judge and admin login</h2><p><input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /></p>
    <p><input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} /></p><button className="btn b" onClick={login}>Log in</button><p className="err">{msg}</p></div>
  if (!role) return <div className="wrap"><h2 className="s">No access yet</h2><p>You are logged in, but your account has not been added as a judge or admin. Ask the organiser to add it.</p><button className="btn g" onClick={() => supabase.auth.signOut().then(() => setUser(null))}>Log out</button></div>
  const dirty = Object.keys(draft).filter(k => draft[k] !== '' && draft[k] !== String(saved[k] ?? '')).length
  return <div className="wrap"><h2 className="s">Score entry <span className="muted" style={{ fontSize: 16 }}>({role})</span></h2>
    {role === 'admin' && <div className="card blue" style={{ marginBottom: 18 }}><h3>Add a student</h3>
      <input placeholder="Full name" value={nm} onChange={e => setNm(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStudent()} />{' '}
      <select value={gr} onChange={e => setGr(e.target.value)}>{[2, 3, 4, 5].map(g => <option key={g} value={g}>Grade {g}</option>)}</select>{' '}
      <button className="btn" onClick={addStudent}>Add student</button><div style={{ marginTop: 8 }}>{note}</div>
      <details style={{ marginTop: 8 }}><summary>{all.length} students registered (tap to view or delete)</summary>
        <div style={{ maxHeight: 220, overflow: 'auto', background: '#fff', color: 'var(--ink)', borderRadius: 14, padding: 8, marginTop: 8 }}>
          {all.map(st => <div key={st.id} style={{ display: 'flex', gap: 10, padding: '4px 6px' }}><span style={{ flex: 1 }}>{st.full_name} (Grade {st.grade})</span><button className="btn g" onClick={() => removeStudent(st)}>Delete</button></div>)}</div></details></div>}
    <p><select value={act?.id ?? ''} onChange={e => { const a = acts.find(x => x.id === e.target.value); if (a) load(a) }}><option value="">Select activity</option>{acts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{' '}
      <button className="btn g" onClick={() => supabase.auth.signOut().then(() => setUser(null))}>Log out</button></p>
    {!acts.length && <p className="muted">No activities are assigned to you yet.</p>}
    {act && <><p className="muted">Maximum score: {act.max_score}. Leave a student blank if they did not take part. Orange boxes are unsaved, green boxes are saved.</p>
      <div className="box"><table><thead><tr><th>Student</th><th>Grade</th><th>Score</th></tr></thead><tbody>
        {studs.map(s => { const v = draft[s.id] ?? (saved[s.id] !== undefined ? String(saved[s.id]) : ''); const isD = draft[s.id] !== undefined && draft[s.id] !== String(saved[s.id] ?? '')
          return <tr key={s.id}><td><b>{s.full_name}</b></td><td>{s.grade}</td><td><input inputMode="decimal" size={6} value={v} className={isD ? 'dirty' : saved[s.id] !== undefined ? 'saved' : ''} onChange={e => setDraft({ ...draft, [s.id]: e.target.value })} /></td></tr> })}
      </tbody></table></div>
      <button className="btn" onClick={save} disabled={!dirty}>Save {dirty || ''} changed score{dirty === 1 ? '' : 's'}</button> <span className={msg.startsWith('Saved') ? '' : 'err'}>{msg}</span></>}</div>
}

export default function App() {
  const route = useRoute()
  if (route === '/display') return <Display />
  const g = route.match(/^\/grade\/([2-5])$/)
  return <><Nav route={route} />
    {route === '/' && <Home />}
    {route === '/activities' && <ActivitiesPage />}
    {g && <div className="wrap"><h2 className="s">Grade {g[1]} leaderboard</h2><Tabs route={route} /><Board f={{ grade: Number(g[1]) }} /></div>}
    {(route === '/lower' || route === '/upper') && <div className="wrap"><h2 className="s">{route === '/lower' ? 'Lower Grade (Grades 2-3)' : 'Upper Grade (Grades 4-5)'} overall</h2><Tabs route={route} /><Board f={{ division: route === '/lower' ? 'Lower' : 'Upper' }} /></div>}
    {route === '/winners' && <Winners />}
    {route === '/judge' && <Judge />}</>
}
