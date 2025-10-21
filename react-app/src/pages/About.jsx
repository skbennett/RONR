// src/pages/About.jsx
import React from 'react';

import '../App.css'; 
import meetingRoomImage from '../Images/meeting_room.jpg';

function About() {
  return (
    <div className="main-content about-page">
      <div className="about-image-top">
        <img src={meetingRoomImage} alt="Meeting Room" className="about-image-full" />
      </div>
      <h1 style={{ fontWeight: 'bold', marginBottom: '20px' }}>About Us</h1>
      <div className="about-section">
        <div className="about-details">
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#005a9c', marginBottom: '16px' }}>
            CourtOrder helps organizations run structured, efficient meetings by following Robert's Rules of Order, streamlining motions, debates, and votes into one easy platform.
          </p>
          <div className="about-card">
            <h2>Our Mission</h2>
            <p style={{ fontSize: '20px', color: '#333', lineHeight: '1.5' }}>Empowering teams to make decisions transparently and efficiently, ensuring every voice is heard and every meeting is productive.</p>
          </div>
          <div className="about-card">
            <h2>Background</h2>
            <p style={{ fontSize: '20px', color: '#333', lineHeight: '1.5' }}>Founded in 2025, CourtOrder was created by a group of passionate organizers who saw the need for a modern solution to classic meeting challenges.</p>
          </div>
          <div className="about-card">
            <h2>Contact Us</h2>
            <p>Email: support@courtorder.com</p>
            <p>Twitter: @CourtOrderApp</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;