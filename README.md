# CartMate AI — Conversational E-Commerce Agent

**CartMate AI** is a next-generation conversational shopping platform that brings the power of Generative AI, Real-time Voice Recognition, and Visual Search to your fingertips. Stop clicking through endless filters—just ask CartMate for what you want!

---

## 🌟 Key Features

1. **🎤 Real-Time Voice Search:**
   - Powered by **Speechmatics Real-Time API**.
   - Speak naturally to the AI. As you speak, your voice is captured and transcribed instantly inside the browser and sent via WebSockets directly to the backend.

2. **📷 Visual Product Match:**
   - Snap a picture of any item using your webcam.
   - Powered by **Gemini Vision** to extract attributes (color, style, category) and find similar items online.

3. **🛍️ Live Product Fetching:**
   - Connects to the real world using **SerpApi (Google Shopping Engine)**.
   - Automatically searches the internet to fetch up-to-date, real products matching your descriptions with live prices and direct "View Store" links.

4. **✨ Responsive & Modern UI:**
   - A fully responsive Single Page Application (SPA) built with React and Vite.
   - Includes a sleek Landing Page, About Us, Contact, and a dedicated AI Chat Agent view that preserves history while you navigate.

5. **🚀 Ready for Vercel Deployment:**
   - Configured out-of-the-box for serverless deployment on Vercel. 

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React, Vite, CSS (Vanilla, Fully Responsive), Lucide Icons.
- **Backend:** Python, FastAPI, WebSockets (for Speechmatics relay).
- **LLM Engine:** Gemini 3.1 Pro / Gemini Flash via **AIMLAPI**.
- **Voice-to-Text:** Speechmatics V2 Real-Time API.
- **Product Search:** SerpApi Google Shopping.

---

## 🚀 How to Run Locally

### Prerequisites
Make sure you have **Node.js (v18+)** and **Python (v3.10+)** installed.

### 1. Environment Setup
In the `backend` folder, create or edit the `.env` file with your keys:
```env
AIMLAPI_KEY=your_aiml_api_key
SPEECHMATICS_API_KEY=your_speechmatics_key
SERPAPI_KEY=your_serpapi_key
```

### 2. Start the Backend (FastAPI)
Open a terminal and run:
```bash
cd backend
python -m venv venv
# On Windows: .\venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*The backend will run on `http://localhost:8000`.*

### 3. Start the Frontend (Vite)
Open a new terminal and run:
```bash
cd frontend
npm install
npm run dev
```
*The frontend will run on `http://localhost:5173`.*

---

## ☁️ How to Deploy on Vercel

The project is fully structured for Vercel Serverless deployment.
1. Push this entire repository to your GitHub account.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**, then import your repository.
3. Vercel will automatically read the `vercel.json` file at the root.
4. **Important:** Add your API keys (`AIMLAPI_KEY`, `SPEECHMATICS_API_KEY`, `SERPAPI_KEY`) to the **Environment Variables** in the Vercel deployment settings.
5. Click **Deploy**. Vercel will build your React frontend and deploy the FastAPI backend as Serverless Functions.

---
*Built with ❤️ for the Future of Commerce.*
