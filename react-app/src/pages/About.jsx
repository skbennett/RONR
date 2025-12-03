// src/pages/About.jsx
import React from 'react';
import '../App.css';
import './home.css';
import meetingRoomImage from '../Images/meeting_room.jpg';

function About() {
  return (
    <main className="main-content about-page">
      {/* Hero (reuse home hero styles) */}
      <section className="hero about-hero">
        <img src={meetingRoomImage} alt="Meeting Room" className="hero-image about-hero-image" />

        {/* overlay slogan shown on wide screens */}
        <div className="overlay-slogan" aria-hidden="true">
          <span className="overlay-text">Better Meetings, Better Decisions.</span>
        </div>

        <div className="hero-text about-hero-text">
          <h1>
            <span className="brand">CourtOrder</span>
            <span className="tagline">Better Meetings, Better Decisions.</span>
          </h1>
          {/* mission statement moved below the hero to avoid duplication */}

          {/* CTAs moved below the narrative to avoid overlapping the hero image */}
        </div>

      </section>

      {/* Narrative / Values */}
      <section className="about-narrative" style={{ paddingTop: '18px' }}>
        <p className="mission-statement" style={{ textAlign: 'center', maxWidth: '62ch', margin: '0 auto' }}>
          Following Robert's Rules of Order (RONR), CourtOrder streamlines meetings with structured
          agendas, clear motions, and built-in voting, making decision processes simple, transparent,
          and efficient so every meeting finishes with a clear result.
        </p>
        <p className="names-list" style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '10px' }}>
          Created by Jason, Keegan, and Shane
        </p>

        {/* Call-to-action buttons placed below the created-by line */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div className="cta-row">
            <button className="btn" onClick={() => (window.location.href = '/')}>Home</button>
            <button className="btn secondary" onClick={() => (window.location.href = '/meetings')}>Get Started</button>
          </div>
        </div>
      </section>

      {/* Values grid — use card styles from home.css for visual consistency */}
      <section className="about-grid-section" style={{ marginTop: '8px' }}>
        <div className="features">
          <article className="card">
            <div className="badge">Mission</div>
            <h3>Our Mission</h3>
            <p>
              We help groups make clear, fair decisions with simple, Robert's Rules–inspired tools
              for agendas, motions, and recorded votes.
            </p>
          </article>

          <article className="card">
            <div className="badge">Story</div>
            <h3>Our Story</h3>
            <p>
              CourtOrder began as a CSCI 432 project at William & Mary to modernize parliamentary
              procedure through user-centered design.
            </p>
          </article>

          <article className="card">
            <div className="badge">Explore</div>
            <h3>Check Us Out</h3>
            <p>
              Github: <a href="https://github.com/skbennett/RONR">github.com/skbennett/RONR</a>
            </p>
            <p>
              Youtube: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">youtube.com/CourtOrder</a>
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default About;