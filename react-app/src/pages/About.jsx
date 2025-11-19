// src/pages/About.jsx
import React from 'react';
import '../App.css'; 
import meetingRoomImage from '../Images/meeting_room.jpg';

function About() {
  return (
    <div className="main-content about-page">
      {/* 1. Hero Section */}
      <div className="about-hero">
        <img src={meetingRoomImage} alt="Meeting Room" className="about-hero-image" />
        <div className="about-hero-text">
          <h1 style={{ color: '#FFFFFFFF' }}>Better Meetings, Better Decisions.</h1>
        </div>
      </div>

      {/* 2. Narrative Section (The text you centered earlier) */}
      <section className="about-narrative">
        <p className="mission-statement">
          CourtOrder helps organizations run structured, efficient meetings by following Robert's Rules of Order, 
          streamlining motions, debates, and votes into one easy platform. It helps manage teams to stay organized 
          and make decisions democratically. As well as keeping meetings on track, CourtOrder fosters transparency 
          and inclusivity in decision-making.
        </p>
      </section>

      {/* 3. Values / Details Grid (Clean 3-column layout) */}
      <section className="about-grid-section">
        <div className="grid-container">
          <div className="grid-item">
            <h3>Our Mission</h3>
            <p>Empowering teams to make decisions transparently and efficiently, ensuring every voice is heard and every meeting is productive.</p>
          </div>
          <div className="grid-item">
            <h3>Our Story</h3>
            <p>Founded in 2025, CourtOrder was created by a group of passionate organizers who saw the need for a modern solution to classic meeting challenges.</p>
          </div>
          <div className="grid-item">
            <h3>Get in Touch</h3>
            <p>Email: <a href="mailto:support@courtorder.com">support@courtorder.com</a></p>
            <p>Twitter: @CourtOrderApp</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;