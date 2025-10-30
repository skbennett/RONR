// /pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5000'; // Flask default port

function Login() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // --- EVENT HANDLERS ---
  const handleLogin = async (e) => {
  e.preventDefault();
  
  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      login(username);
      alert(`Welcome, ${username}!`);
      navigate('/');
    } else {
      alert('Invalid username or password.');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Failed to login. Please check if the server is running.');
  } finally {
    setLoading(false);
  }
};

  const handleCreateAccount = async () => {
    if (!username || !email || !password) {
      alert('Please fill out all fields to create an account.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password, // Note: Should be hashed on backend
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Account created successfully! You can now log in.');
        // Clear fields and switch back to login mode
        setUsername('');
        setEmail('');
        setPassword('');
        setIsCreatingAccount(false);
      } else {
        alert(data.error || 'Failed to create account.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to create account. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsCreatingAccount(!isCreatingAccount);
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="login-container">
      <h2>{isCreatingAccount ? 'Create Account' : 'Member Login'}</h2>
      
      <form onSubmit={handleLogin}>
        <input
          type="text"
          id="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />
        
        {isCreatingAccount && (
          <input
            type="email"
            id="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        )}
        
        <input
          type="password"
          id="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        
        {!isCreatingAccount && (
          <button type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        )}
      </form>
      
      <div className="login-actions">
        {isCreatingAccount ? (
          <>
            <button 
              type="button" 
              className="create-account" 
              onClick={handleCreateAccount}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
            <button 
              type="button" 
              className="toggle-mode" 
              onClick={toggleMode}
              disabled={loading}
            >
              Back to Login
            </button>
          </>
        ) : (
          <button 
            type="button" 
            className="create-account" 
            onClick={toggleMode}
            disabled={loading}
          >
            Create New Account
          </button>
        )}
        
        <button 
          type="button" 
          className="back-to-home-btn" 
          onClick={() => navigate('/')}
          disabled={loading}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Login;