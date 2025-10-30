// src/App.jsx

import React, { useEffect } from 'react';
// This import will now work correctly after you install the package
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/navbar.jsx';
import Home from './pages/Home.jsx';
import Meetings from './pages/Meetings.jsx';   
import Coordination from './pages/Coordination.jsx';
import About from './pages/About.jsx';
import Login from './pages/Login.jsx';
import CreateAccount from './pages/CreateAccount.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { initializeAllData } from './services/dataManager.js';

function App() {
  useEffect(() => {
    initializeAllData();
  }, []);
  
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/meetings" element={
              <ProtectedRoute>
                <Meetings />
              </ProtectedRoute>
            } />
            <Route path="/coordination" element={
              <ProtectedRoute>
                <Coordination />
              </ProtectedRoute>
            } />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
              <Route path="/create-account" element={<CreateAccount />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;