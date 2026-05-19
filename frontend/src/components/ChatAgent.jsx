import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Mic, MicOff, Camera, X, Volume2, VolumeX, Send, Image as ImageIcon } from 'lucide-react';
import '../index.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function ChatAgent() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [inputText, setInputText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  
  const chatEndRef = useRef(null);
  const webcamRef = useRef(null);
  const [audioWs, setAudioWs] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    axios.post(`${API_BASE}/session`)
      .then(res => setSessionId(res.data.session_id))
      .catch(err => console.error("Failed to init session", err));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, attachedImage]);

  const speakText = (text) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utterance.voice = enVoice;
    window.speechSynthesis.speak(utterance);
  };

  const handleAgentResponse = (text, products) => {
    setMessages(prev => [...prev, { role: 'agent', text, products }]);
    speakText(text);
  };

  const startNativeSpeech = (stream) => {
    // Release raw mic stream since browser native speech engine handles its own stream
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInputText(prev => (prev ? prev + " " : "") + finalTranscript);
      }
      setInterimText(interimTranscript);
    };

    rec.onerror = (e) => {
      console.error("Native speech error:", e.error);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.start();
  };

  const toggleMic = async () => {
    if (isListening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (audioWs) audioWs.close();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      setIsListening(true);
      setInterimText("");
      
      try {
        window.speechSynthesis?.cancel(); // Cancel any ongoing speech
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const host = isLocal ? 'localhost:8000' : window.location.host;
        const wsUrl = `${protocol}//${host}/ws/speech`;
        
        console.log("Attempting Speechmatics WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        setAudioWs(ws);

        let wsConnected = false;
        const connectionTimeout = setTimeout(() => {
          if (!wsConnected) {
            console.warn("WebSocket timed out. Falling back to native Speech Recognition.");
            ws.close();
            startNativeSpeech(stream);
          }
        }, 1500);

        ws.onopen = () => {
          wsConnected = true;
          clearTimeout(connectionTimeout);
          console.log("WebSocket connected to Speechmatics backend.");
          
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data);
            }
          };
          recorder.start(250);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.message === 'AddPartialTranscript') {
              setInterimText(data.metadata.transcript);
            } else if (data.message === 'AddTranscript') {
              setInputText(prev => (prev ? prev + " " : "") + data.metadata.transcript);
              setInterimText("");
            }
          } catch(err) {}
        };

        ws.onerror = (err) => {
            console.error("WS connection error, trying native Speech fallback:", err);
            if (!wsConnected) {
              clearTimeout(connectionTimeout);
              startNativeSpeech(stream);
            } else {
              setIsListening(false);
            }
        };

        ws.onclose = () => {
          if (wsConnected) {
            setIsListening(false);
          }
        };

      } catch (err) {
        console.error("Mic access denied or error:", err);
        setIsListening(false);
        alert("Failed to access microphone. Please check browser permissions.");
      }
    }
  };

  const captureImage = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setAttachedImage(imageSrc);
    setIsCameraActive(false);
  };

  const removeImage = () => {
    setAttachedImage(null);
  };

  const sendRequest = async () => {
    if (!inputText.trim() && !attachedImage) return;
    
    if (isListening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (audioWs) audioWs.close();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    }
    
    const currentText = inputText.trim();
    const currentImg = attachedImage;
    
    setInputText("");
    setAttachedImage(null);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: currentText, 
      image: currentImg 
    }]);
    
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        session_id: sessionId,
        message: currentText,
        image_base64: currentImg
      });
      handleAgentResponse(res.data.text, res.data.products);
    } catch (err) {
      console.error(err);
      handleAgentResponse("Sorry, I had an error processing that.", []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>CartMate AI</h1>
        <div>
          <button className={`btn-icon ${isMuted ? 'active' : ''}`} onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      <main className="chat-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', maxWidth: '300px' }}>
              <Mic size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
              <h3>Real Voice Input</h3>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Tap the mic to dictate what you want to buy. Then hit Send.</p>
            </div>
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', maxWidth: '300px' }}>
              <ImageIcon size={32} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
              <h3>Optional Image</h3>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Tap camera to snap a photo and send it along with your text.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.image && (
              <img src={msg.image} alt="User upload" style={{ width: '150px', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '2px solid rgba(255,255,255,0.1)' }} />
            )}
            {msg.text && <div style={{ fontSize: '1rem' }}>{msg.text}</div>}
            
            {msg.products && msg.products.length > 0 && (
              <div className="products-grid">
                {msg.products.map(p => (
                  <div key={p.id} className="product-card">
                    <img src={p.image_url} alt={p.name} className="product-image" />
                    <div className="product-info">
                      <div className="product-name">{p.name}</div>
                      <div className="product-price">${p.price.toFixed(2)}</div>
                      <div className="product-desc">{p.description}</div>
                      {p.product_link && (
                        <a 
                          href={p.product_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            marginTop: '0.75rem',
                            padding: '0.5rem 1rem',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            borderRadius: '0.5rem',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            textAlign: 'center',
                            width: '100%'
                          }}
                        >
                          View Store
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message agent">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <div style={{ padding: '1rem', backgroundColor: 'var(--surface)', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        
        {attachedImage && (
           <div style={{ position: 'relative', width: 'fit-content' }}>
              <img src={attachedImage} alt="preview" style={{ height: '80px', borderRadius: '0.5rem', border: '2px solid var(--primary)' }} />
              <button onClick={removeImage} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <X size={16} />
              </button>
           </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className={`btn-icon ${isListening ? 'active' : ''}`} style={{ backgroundColor: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)', padding: '0.75rem' }} onClick={toggleMic} title="Voice Input">
            {isListening ? <MicOff size={24} color="var(--danger)" /> : <Mic size={24} color="white" />}
          </button>
          
          <button className="btn-icon" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '0.75rem' }} onClick={() => setIsCameraActive(true)} title="Attach Image">
            <Camera size={24} color="white" />
          </button>

          <input 
             type="text" 
             value={inputText + (interimText ? (inputText ? " " : "") + interimText : "")}
             onChange={(e) => {
                 setInputText(e.target.value);
                 setInterimText("");
             }}
             placeholder={isListening ? "Listening..." : "Type or speak your request..."}
             style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '2rem', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'white', outline: 'none', fontSize: '1rem' }}
             onKeyPress={(e) => { if(e.key === 'Enter') sendRequest(); }}
          />

          <button onClick={sendRequest} style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
             <Send size={20} />
          </button>
        </div>
      </div>

      {isListening && (
        <div className="voice-overlay">
          <div className="voice-container">
            <div className="voice-mic-pulser">
              <Mic size={40} color="white" />
            </div>
            <div className="voice-status">Listening...</div>
            <div className="voice-transcript">
              {interimText || inputText ? `"${interimText || inputText}"` : "Speak now, CartMate is listening..."}
            </div>
          </div>
          <button className="voice-stop-btn" onClick={toggleMic}>
            <MicOff size={20} /> Done Speaking
          </button>
        </div>
      )}

      {isCameraActive && (
        <div className="camera-overlay">
          <button className="camera-close" onClick={() => setIsCameraActive(false)}>
            <X size={28} />
          </button>
          <div className="camera-container">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width="100%"
              videoConstraints={{ facingMode: "environment" }}
            />
          </div>
          <button className="camera-capture-btn" onClick={captureImage}>
            <Camera size={24} /> Capture
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatAgent;
