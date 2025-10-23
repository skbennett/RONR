// src/pages/CreateAccount.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function CreateAccount() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // --- EVENT HANDLERS ---
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!username || !password || !confirmPassword) {
      setError('Please fill in all fields.');
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

    // Get existing users from localStorage
    const users = JSON.parse(localStorage.getItem('courtorder_users') || '{}');

    // Check if username is taken
    if (users[username]) {
      setError('This username is already taken. Please choose another.');
      return;
    }

    // Add new user
    users[username] = password;
    localStorage.setItem('courtorder_users', JSON.stringify(users));

    // Show success message and redirect to login
    alert('Account created successfully! Please log in.');
    navigate('/login');
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
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
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
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="create-account-btn">Create Account</button>
          <button type="button" className="back-to-login-btn" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateAccount;