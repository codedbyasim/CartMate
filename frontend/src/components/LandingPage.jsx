import React from 'react';

export default function LandingPage({ setCurrentPage }) {
  return (
    <div className="landing-page">
      <div className="hero-section">
        <h1 className="hero-title">The Future of <br/><span className="highlight">Conversational Commerce</span></h1>
        <p className="hero-subtitle">
          Discover products effortlessly using your voice or visual search. 
          CartMate brings the entire web to your fingertips with AI-powered matching.
        </p>
        <div className="hero-actions">
          <button className="btn-large" onClick={() => setCurrentPage('chat')}>Start Shopping</button>
          <button className="btn-large btn-outline" onClick={() => setCurrentPage('about')}>Learn More</button>
        </div>
      </div>
      <div className="features-section">
        <div className="feature-card">
          <h3>🎤 Voice Search</h3>
          <p>Just talk to the agent like a real human. Tell it what you need and get tailored recommendations.</p>
        </div>
        <div className="feature-card">
          <h3>📷 Visual Match</h3>
          <p>See something you like? Snap a photo and let AI find exactly what you're looking for.</p>
        </div>
        <div className="feature-card">
          <h3>🛍️ Real Products</h3>
          <p>Powered by Google Shopping to find the best deals and real products across the entire web.</p>
        </div>
      </div>
    </div>
  );
}
