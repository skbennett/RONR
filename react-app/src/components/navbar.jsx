// src/components/Navbar.jsx

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UsernamePopup from './UsernamePopup';
import supabase from '../supabaseClient';

// Import your logo image
import gavelLogo from '../Images/Court Gavel.png';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUsernamePopupOpen, setIsUsernamePopupOpen] = useState(false);
  const [displayName, setDisplayName] = useState('Member');
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut } = useAuth()

  useEffect(() => {
    const fetchUsername = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        
        if (!error && data?.username) {
          setDisplayName(data.username);
        } else {
          // Fallback to user metadata or email
          setDisplayName(
            user.user_metadata?.username || 
            user.user_metadata?.full_name || 
            (user.email ? user.email.split('@')[0] : 'Member')
          );
        }
      } else {
        setDisplayName('Member');
      }
    };

    fetchUsername();
  }, [user, isUsernamePopupOpen]); // Re-fetch when popup closes (via isUsernamePopupOpen change)

  const handleLinkClick = (path) => {
    setIsMenuOpen(false);
    if (path) {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    await signOut()
    setIsMenuOpen(false)
    navigate('/')
  }

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
          <Link to="/about">About</Link>
        </div>
        
        {/* --- Desktop Auth Button --- */}
        {isAuthenticated ? (
          <div className="user-info desktop-only">
            <button className="username-btn" onClick={() => setIsUsernamePopupOpen(true)}>
              Change Name
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              {`Sign Out (${displayName})`}
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
            <button className="username-btn-mobile" onClick={() => { setIsUsernamePopupOpen(true); setIsMenuOpen(false); }}>
              Change Name
            </button>
            <button className="logout-btn-mobile" onClick={handleLogout}>
              {`Sign Out (${displayName})`}
            </button>
          </div>
        ) : (
          <button className="sign-in-btn-mobile" onClick={() => handleLinkClick('/login')}>
            Sign In
          </button>
        )}
      </div>

      {/* Username Change Popup */}
      <UsernamePopup
        isOpen={isUsernamePopupOpen}
        onClose={() => setIsUsernamePopupOpen(false)}
        currentUsername={displayName}
        userId={user?.id}
      />
    </>
  );
}

export default Navbar;