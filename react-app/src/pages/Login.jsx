// /pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5000'; // Flask default port

function Login() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth(); // This is the login function from AuthContext

  // --- EVENT HANDLERS ---
  
  // 1. THIS IS THE MISSING FUNCTION
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      alert('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      // Assumes your backend has a '/login' endpoint
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) { // Check for success flag from server
        login(username); // Call the context login function to set auth state
        navigate('/'); // Navigate to home page on success
      } else {
        alert(data.error || 'Invalid username or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to login. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // 2. This function navigates to the create account page
  const handleNavigateToCreate = () => {
    navigate('/create-account');
  };

  return (
    // 3. The component is now simplified
    <div className="login-container">
      <h2>Member Login</h2>
      
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
        {/* This button now navigates instead of toggling */}
        <button 
          type="button" 
          className="create-account" 
          onClick={handleNavigateToCreate}
          disabled={loading}
        >
          Create New Account
        </button>
        
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