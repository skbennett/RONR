// src/pages/Home.jsx
import React from 'react';

// Import your stylesheet
import '../index.css'; 

// Import images from your assets folder
// We no longer need gavelImage, Link, or useNavigate in this component
import congressImage from '../Images/House of Reps.webp';

function Home() {
  return (
    // The <nav> element and its content have been removed.
    // The Navbar component in App.jsx will now handle the navigation.
    <div className="main-content">
      <h1 style={{ fontWeight: 'bold' }}>CourtOrder</h1>
      <img 
        src={congressImage} 
        alt="Congress Meeting" 
        style={{ width: '100%', marginTop: '24px', borderRadius: '12px' }} 
      />
      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#005a9c'}}>CourtOrder helps organizations run structured, efficient meetings by following 
        Robert's Rules of Order, streamlining motions, debates, and votes into one easy platform.</p>
    </div>
  );
}

export default Home;