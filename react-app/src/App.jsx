// src/App.jsx

import React from 'react';
// This import will now work correctly after you install the package
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/navbar.jsx';
import Home from './pages/Home.jsx';
import Meetings from './pages/Meetings.jsx';   
import Coordination from './pages/Coordination.jsx';
import Login from './pages/Login.jsx';       

function App() {
  return (
    <Router>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/coordination" element={<Coordination />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;