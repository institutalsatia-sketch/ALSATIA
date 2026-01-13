import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert("Erreur : " + error.message)
    else window.location.href = '/' // Redirection vers le dashboard
  }

  return (
    <div style={{ backgroundColor: '#262f78', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', width: '300px' }}>
        <h2 style={{ color: '#262f78', textAlign: 'center' }}>Institut Alsatia</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.set(e.target.value))} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} required />
        <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', marginBottom: '20px', padding: '8px' }} required />
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#262f78', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Se connecter</button>
      </form>
    </div>
  )
}
