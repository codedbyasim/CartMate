import React from 'react';
import '../index.css';

export default function Navbar({ currentPage, setCurrentPage }) {
  return (
    <nav className="main-navbar">
      <div className="nav-logo" onClick={() => setCurrentPage('home')}>CartMate AI</div>
      <div className="nav-links">
        <button className={`nav-btn ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>Home</button>
        <button className={`nav-btn ${currentPage === 'about' ? 'active' : ''}`} onClick={() => setCurrentPage('about')}>About</button>
        <button className={`nav-btn ${currentPage === 'contact' ? 'active' : ''}`} onClick={() => setCurrentPage('contact')}>Contact</button>
        <button className="nav-btn-primary" onClick={() => setCurrentPage('chat')}>Try Agent</button>
      </div>
    </nav>
  );
}
