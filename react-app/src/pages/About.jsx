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
          Following Robert's Rules of Order (RONR), our web app aims to streamline meetings by providing 
          meeting scheduling, sctructured motions, real time chatting, and voting functionalities to ensure efficient and RONR compliant decision-making.
        </p>
        <p className="names-list">
          Created By - Jason, Keegan, and Shane
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
            <p>CourtOrder was created as a project for CSCI 432 (Web Development) at William and Mary in Fall 2025.</p>
          </div>
          <div className="grid-item">
            <h3>Check It Out</h3>
            <p>Github: <a href="https://github.com/skbennett/RONR">https://github.com/skbennett/RONR</a></p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;