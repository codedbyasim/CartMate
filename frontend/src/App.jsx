import React, { useState } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import ChatAgent from './components/ChatAgent';
import './index.css';
import './layout.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="main-layout">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      <div className="page-content">
        {currentPage === 'home' && <LandingPage setCurrentPage={setCurrentPage} />}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'contact' && <ContactPage />}
        
        {/* We hide the chat agent instead of unmounting it to keep chat history intact */}
        <div style={{ display: currentPage === 'chat' ? 'block' : 'none', height: '100%' }}>
          <ChatAgent />
        </div>
      </div>
    </div>
  );
}

export default App;
