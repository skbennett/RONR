// src/pages/CreateAccount.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function CreateAccount() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Added loading state
  const navigate = useNavigate()
  const { signUp } = useAuth()

  // --- EVENT HANDLERS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- 1. Client-side Validation ---
    if (!username || !password || !confirmPassword || !email) {
      setError('Please fill in all fields.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    // --- 2. Supabase Auth Sign Up ---
    setLoading(true)
    try {
      // Use Supabase signUp (email + password)
      const { data, error: signUpError } = await signUp(email, password, username)

      if (signUpError) {
        // Supabase returns helpful error messages
        setError(signUpError.message || 'Failed to create account. Please try again.')
        return
      }

      // Optionally you could store the username in a separate profiles table.
      // For now, inform the user and navigate to login (or show confirmation if email confirm required).
      alert('Account created successfully! Please check your email to confirm (if required), then log in.')
      navigate('/login')
    } catch (err) {
      console.error('Registration error:', err)
      setError('Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="create-account-container">
      <h2>Create Account</h2>
      <form onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
            disabled={loading} // Disable input when loading
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email" // Use type="email" for better validation
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            required
            disabled={loading} // Disable input when loading
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 characters)"
            required
            disabled={loading} // Disable input when loading
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            disabled={loading} // Disable input when loading
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="create-account-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          <button
            type="button"
            className="back-to-login-btn"
            onClick={() => navigate('/login')}
            disabled={loading} // Disable button when loading
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateAccount;