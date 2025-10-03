// /pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

class AuthManager {
    constructor() {
        this.USERS_KEY = 'courtorder_users';
        this.AUTH_KEY = 'courtorder_auth';
        this.initializeDefaultUser();
    }
    initializeDefaultUser() {
        const users = this.getUsers();
        if (Object.keys(users).length === 0) {
            users['admin'] = 'password123';
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
    }
    getUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
        } catch (e) { return {}; }
    }
    addUser(username, password) {
        const users = this.getUsers();
        if (users[username]) {
            return false;
        }
        users[username] = password;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return true;
    }
    validateUser(username, password) {
        const users = this.getUsers();
        return users[username] && users[username] === password;
    }
    login(username) {
        const authData = { isLoggedIn: true, username: username };
        localStorage.setItem(this.AUTH_KEY, JSON.stringify(authData));
    }
}
const authManager = new AuthManager();


function Login() {
  // --- STATE MANAGEMENT ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // --- EVENT HANDLERS ---
  const handleLogin = (e) => {
    e.preventDefault(); // Prevent form from reloading the page
    if (!username || !password) {
      alert('Please enter both username and password.');
      return;
    }
    if (authManager.validateUser(username, password)) {
      authManager.login(username);
      alert(`Welcome, ${username}!`);
      navigate('/'); // Redirect to home page after successful login
    } else {
      alert('Invalid username or password.');
    }
  };

  const handleCreateAccount = () => {
    if (!username || !password) {
      alert('Please fill out both username and password fields to create an account.');
      return;
    }
    if (authManager.addUser(username, password)) {
      alert('Account created successfully! You can now log in.');
      // Clear fields
      setUsername('');
      setPassword('');
    } else {
      alert('This username is already taken. Please choose another.');
    }
  };


  return (
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
        />
        <input
          type="password"
          id="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign In</button>
      </form>
      
      <div className="login-actions">
        <button type="button" className="create-account" onClick={handleCreateAccount}>
          Create Account
        </button>
         <button type="button" className="back-to-home-btn" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Login;