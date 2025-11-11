// src/pages/CreateAccount.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// We don't need useAuth here, as we are creating an account, not logging in
// import { useAuth } from '../contexts/AuthContext';

// Define the API URL for your backend
const API_URL = 'http://localhost:5000'; // Or your backend server address

function CreateAccount() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Added loading state
  const navigate = useNavigate();

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

    // --- 2. API Call ---
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/create-account`, { // Assuming a /create-account endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // --- 3. Handle Success ---
        alert('Account created successfully! Please log in.');
        navigate('/login'); // Redirect to login page
      } else {
        // --- 4. Handle Server-side Errors ---
        setError(data.error || 'Failed to create account. Please try again.');
      }
    } catch (error) {
      // --- 5. Handle Network/Fetch Errors ---
      console.error('Registration error:', error);
      setError('Failed to create account. Please check if the server is running.');
    } finally {
      setLoading(false);
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