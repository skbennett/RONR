// src/App.jsx

import React from 'react';
// This import will now work correctly after you install the package
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/navbar.jsx';
import Home from './pages/Home.jsx';
import Meetings from './pages/Meetings.jsx';   
import Coordination from './pages/Coordination.jsx';
import Login from './pages/Login.jsx';
import About from './pages/About.jsx';     

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
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;