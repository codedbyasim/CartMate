import React from 'react';

export default function ContactPage() {
  return (
    <div className="page-container">
      <div className="content-card">
        <h2>Contact Us</h2>
        <p>Have questions or feedback? We'd love to hear from you!</p>
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <input type="text" placeholder="Your Name" required />
          <input type="email" placeholder="Your Email" required />
          <textarea placeholder="Your Message" rows="5" required></textarea>
          <button type="submit" className="btn-large">Send Message</button>
        </form>
      </div>
    </div>
  );
}
