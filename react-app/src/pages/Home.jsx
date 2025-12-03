// src/pages/Home.jsx
import React from 'react';

import '../index.css';
import './home.css';

import congressImage from '../Images/House of Reps.webp';

function Home() {
  return (
    <main className="main-content" aria-labelledby="home-title">
      <section className="hero">
        <div className="hero-text">
          <h1 id="home-title">
            <span className="brand">CourtOrder</span>
            <span className="tagline">Run Meetings with Structure</span>
          </h1>
          <p>
            CourtOrder brings Robert's Rules to a simple online workspace: Create agendas, manage motions and
            debates, and run secure votes with instant tallies. All results are recorded and exportable as
            official minutes for a clear meeting history.
          </p>

          <div className="cta-row">
            <button className="btn" onClick={() => window.location.href = '/meetings'}>Get Started</button>
            <button className="btn secondary" onClick={() => window.location.href = '/about'}>Learn More</button>
          </div>
        </div>

        <div>
          <img src={congressImage} alt="Legislative meeting" className="hero-image" />
        </div>
      </section>

      <section className="features" aria-label="Key features">
        <article className="card">
          <div className="badge">Core</div>
          <h3>Structured Agendas</h3>
          <p>Create, share, and follow agendas that guide meeting flow and keep the group on-topic.</p>
        </article>

        <article className="card">
          <div className="badge">Workflow</div>
          <h3>Streamlined Motions</h3>
          <p>Propose, second, debate, and vote on motions in a clear, auditable workflow for users.</p>
        </article>

        <article className="card">
          <div className="badge">Records</div>
          <h3>Transparent Results</h3>
          <p>Record outcomes, generate minutes, and maintain a searchable history of decisions.</p>
        </article>

        <article className="card">
          <div className="badge">Voting</div>
          <h3>Voting &amp; Tally</h3>
          <p>Run efficient votes with instant tallies, ballots, and exportable results for transparency.</p>
        </article>
      </section>

      <div className="footer-compact">
        <div>© {new Date().getFullYear()} CourtOrder</div>
        <div style={{color:'#9aa4b2'}}>Designed with Robert's Rules in mind</div>
      </div>
    </main>
  );
}

export default Home;