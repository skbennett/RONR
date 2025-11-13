// /pages/Login.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await signIn(email, password)
      if (error) {
        setError(error.message || 'Invalid credentials')
        return
      }

      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleNavigateToCreate = () => navigate('/create-account')

  return (
    <div className="login-container">
      <h2>Member Login</h2>

      {error && (
        <div className="login-error" style={{ color: 'var(--error, #b00020)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <input
          type="email"
          id="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <input
          type="password"
          id="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="login-actions">
        <button type="button" className="create-account" onClick={handleNavigateToCreate} disabled={loading}>
          Create New Account
        </button>

        <button type="button" className="back-to-home-btn" onClick={() => navigate('/')} disabled={loading}>
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default Login