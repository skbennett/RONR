// src/components/Navbar.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Import your logo image
import gavelLogo from '../Images/Court Gavel.png';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const handleLinkClick = (path) => {
    setIsMenuOpen(false);
    if (path) {
      navigate(path);
    }
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
          <Link to="/" onClick={() => setIsMenuOpen(false)}>
            <img 
              src={gavelLogo} 
              alt="Gavel Logo" 
              style={{ height: '40px', verticalAlign: 'middle' }} 
            />
            <span style={{ marginLeft: '12px' }}>CourtOrder</span>
          </Link>
        </div>

        {/* --- Desktop Navigation Links --- */}
        <div className="nav-links desktop-only">
          <Link to="/Meetings">Meetings</Link>
          <Link to="/coordination">Coordination</Link>
          <a href="https://en.wikipedia.org/wiki/Robert%27s_Rules_of_Order" target="_blank" rel="noopener noreferrer">
            About
          </a>
        </div>
        
        {/* --- Desktop Auth Button --- */}
        {isAuthenticated ? (
          <div className="user-info desktop-only">
            <button className="logout-btn" onClick={handleLogout}>
              Sign Out (Admin)
            </button>
          </div>
        ) : (
          <button className="sign-in-btn desktop-only" onClick={() => navigate('/login')}>
            Sign In
          </button>
        )}

        {/* --- Hamburger Menu Button (Mobile Only) --- */}
        <button className="hamburger-btn mobile-only" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          &#9776; {/* Hamburger icon */}
        </button>
      </nav>

      {/* --- Mobile Dropdown Menu --- */}
      <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={() => setIsMenuOpen(false)}>
          &times; {/* Close 'X' icon */}
        </button>
        <Link to="/meetings" onClick={() => handleLinkClick()}>Meetings</Link>
        <Link to="/coordination" onClick={() => handleLinkClick()}>Coordination</Link>
        <a href="https://en.wikipedia.org/wiki/Robert%27s_Rules_of_Order" target="_blank" rel="noopener noreferrer" onClick={() => setIsMenuOpen(false)}>
            About
        </a>
        {isAuthenticated ? (
          <div className="mobile-user-info">
            <button className="logout-btn-mobile" onClick={handleLogout}>
              Sign Out (Admin)
            </button>
          </div>
        ) : (
          <button className="sign-in-btn-mobile" onClick={() => handleLinkClick('/login')}>
            Sign In
          </button>
        )}
      </div>
    </>
  );
}

export default Navbar;