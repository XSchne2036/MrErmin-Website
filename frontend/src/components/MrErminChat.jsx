import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import PremiumUpgrade from './PremiumUpgrade';

const GOOGLE_CLIENT_ID = '611753612325-b1m49felg1moh1ublib3udb4n1n8k2j0.apps.googleusercontent.com';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Hook für Google OAuth
function useGoogleOAuth() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);
}

// Google Sign-In Komponente
function GoogleSignIn({ onCredentialResponse }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: onCredentialResponse
        });
        window.google.accounts.id.renderButton(
          containerRef.current,
          { theme: 'outline', size: 'large', text: 'signin_with' }
        );
      }
    };

    if (window.google) {
      initializeGoogle();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google) {
          initializeGoogle();
          clearInterval(checkGoogle);
        }
      }, 100);

      return () => clearInterval(checkGoogle);
    }
  }, [onCredentialResponse]);

  return <div ref={containerRef}></div>;
}

// Chat-Nachricht Komponente
function ChatMessage({ message, isUser, onStreamingUpdate }) {
  return (
    <div className={`flex gap-4 max-w-[85%] ${isUser ? 'self-end' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
        isUser 
          ? 'bg-orange-500 text-white' 
          : 'bg-gray-800 text-white'
      }`}>
        {isUser ? (
          <i className="fas fa-user"></i>
        ) : (
          <img src="/logo.png" alt="Mr Ermin" className="w-10 h-10 rounded-full" />
        )}
      </div>
      <div className={`rounded-2xl px-4 py-3 leading-relaxed ${
        isUser 
          ? 'bg-orange-500 text-white' 
          : 'bg-gray-100 text-gray-900'
      }`}>
        <div dangerouslySetInnerHTML={{ 
          __html: message.content.replace(/\n/g, '<br>').replace(
            /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">$1</a>'
          )
        }} />
      </div>
    </div>
  );
}

// Typing Indicator Komponente
function TypingIndicator() {
  return (
    <div className="flex gap-4 max-w-[85%]">
      <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center">
        <img src="/logo.png" alt="Mr Ermin" className="w-10 h-10 rounded-full" />
      </div>
      <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.4s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Chat History Item Komponente
function ChatHistoryItem({ chat, isActive, onClick, onDelete }) {
  return (
    <div className={`relative p-3 rounded-2xl mb-2 cursor-pointer flex items-center gap-3 transition-all duration-200 bg-white border ${
      isActive ? 'bg-orange-50 border-orange-500 text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
    }`} onClick={onClick}>
      <i className="fas fa-comment"></i>
      <span className="flex-1 truncate">{chat.title}</span>
      <button
        className="opacity-0 group-hover:opacity-100 hover:text-orange-500 transition-opacity text-sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onMouseEnter={(e) => e.target.parentElement.classList.add('group')}
        onMouseLeave={(e) => e.target.parentElement.classList.remove('group')}
      >
        <i className="fas fa-trash"></i>
      </button>
    </div>
  );
}

// Haupt-Chat-Komponente
export default function MrErminChat() {
  // State Management
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showPremiumUpgrade, setShowPremiumUpgrade] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Chat State
  const [chats, setChats] = useState({});
  const [activeChatId, setActiveChatId] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  // LMStudio State
  const [lmstudioUrl, setLmstudioUrl] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  
  // Refs
  const chatContainerRef = useRef(null);
  const chatCounter = useRef(1);
  
  // Google OAuth Hook
  useGoogleOAuth();

  // Initialisierung
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. Lade LMStudio URL
      const response = await fetch('/apiurl.txt');
      if (response.ok) {
        const url = await response.text();
        setLmstudioUrl(url.trim());
        await loadModels(url.trim());
      }

      // 2. Prüfe gespeicherte Session
      const savedToken = localStorage.getItem('mrermin_auth_token');
      const savedUser = localStorage.getItem('mrermin_user');

      if (savedToken && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          const tokenResponse = await axios.get(`${API}/auth/me`, {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          
          if (tokenResponse.status === 200) {
            setAuthToken(savedToken);
            setCurrentUser(tokenResponse.data);
            await loadUserChats(savedToken);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          localStorage.removeItem('mrermin_auth_token');
          localStorage.removeItem('mrermin_user');
        }
      }

      setIsLoading(false);
      setShowLogin(true);
    } catch (error) {
      console.error('Initialization error:', error);
      setIsLoading(false);
      setShowLogin(true);
    }
  };

  const loadModels = async (apiUrl) => {
    try {
      const response = await fetch(`${apiUrl}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        setAvailableModels(models);
        if (models.length > 0) {
          setSelectedModel(models[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadUserChats = async (token) => {
    try {
      const response = await axios.get(`${API}/chats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 200) {
        const chatData = {};
        response.data.forEach(chat => {
          chatData[chat.id] = {
            title: chat.title,
            messages: chat.messages || [],
            serverSynced: true
          };
        });
        setChats(chatData);
        
        if (response.data.length > 0) {
          setActiveChatId(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleGoogleCredential = useCallback(async (response) => {
    try {
      const credential = jwtDecode(response.credential);
      setCurrentUser({
        email: credential.email,
        name: credential.name,
        picture: credential.picture,
        google_id: credential.sub
      });
    } catch (error) {
      console.error('Error processing Google credential:', error);
    }
  }, []);

  const handleLogin = async () => {
    if (!currentUser || !consentGiven) return;

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: currentUser.email,
        name: currentUser.name,
        picture: currentUser.picture,
        google_id: currentUser.google_id
      });

      if (response.status === 200) {
        const { access_token, user } = response.data;
        setAuthToken(access_token);
        setCurrentUser(user);
        
        localStorage.setItem('mrermin_auth_token', access_token);
        localStorage.setItem('mrermin_user', JSON.stringify(user));
        
        await loadUserChats(access_token);
        setIsGuestMode(false);
        setShowLogin(false);
        
        if (Object.keys(chats).length === 0) {
          createNewChat();
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Anmeldung fehlgeschlagen. Versuchen Sie es erneut.');
    }
  };

  const handleGuestMode = () => {
    setIsGuestMode(true);
    setShowLogin(false);
    createNewChat();
  };

  const logout = () => {
    localStorage.removeItem('mrermin_auth_token');
    localStorage.removeItem('mrermin_user');
    setAuthToken(null);
    setCurrentUser(null);
    setIsGuestMode(false);
    setChats({});
    setActiveChatId(null);
    setShowLogin(true);
  };

  const createNewChat = async () => {
    const chatId = isGuestMode ? `guest-chat-${chatCounter.current++}` : `chat-${Date.now()}`;
    const initialTitle = 'Neuer Chat';

    if (isGuestMode) {
      const newChat = {
        title: initialTitle,
        messages: [{ 
          role: 'assistant', 
          content: 'Hallo! Ich bin Mr Ermin. Worüber möchtest du sprechen?',
          timestamp: new Date().toISOString()
        }],
        serverSynced: false
      };
      setChats(prev => ({ [chatId]: newChat, ...prev }));
      setActiveChatId(chatId);
    } else {
      try {
        const response = await axios.post(`${API}/chats`, {
          title: initialTitle
        }, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 200) {
          const chat = response.data;
          const initialMessage = {
            role: 'assistant',
            content: 'Hallo! Ich bin Mr Ermin. Worüber möchtest du sprechen?',
            timestamp: new Date().toISOString()
          };

          await axios.post(`${API}/chats/${chat.id}/messages`, initialMessage, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          const newChat = {
            title: chat.title,
            messages: [initialMessage],
            serverSynced: true
          };

          setChats(prev => ({ [chat.id]: newChat, ...prev }));
          setActiveChatId(chat.id);
        }
      } catch (error) {
        console.error('Error creating chat:', error);
      }
    }
  };

  const deleteChat = async (chatId) => {
    if (!confirm('Möchten Sie diesen Chat wirklich löschen?')) return;

    const newChats = { ...chats };
    delete newChats[chatId];
    setChats(newChats);

    if (activeChatId === chatId) {
      const remainingChats = Object.keys(newChats);
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0]);
      } else {
        setActiveChatId(null);
        createNewChat();
      }
    }

    if (!isGuestMode) {
      try {
        await axios.delete(`${API}/chats/${chatId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const sendMessage = async () => {
    const message = messageInput.trim();
    if (!message || isGenerating) return;

    setMessageInput('');
    setIsGenerating(true);

    // Nachricht zu aktuellem Chat hinzufügen
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        messages: [...prev[activeChatId].messages, userMessage]
      }
    }));

    // Bei angemeldeten Benutzern auch auf Server speichern
    if (!isGuestMode) {
      try {
        await axios.post(`${API}/chats/${activeChatId}/messages`, userMessage, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }

    setIsTyping(true);

    try {
      // LMStudio API Call
      const chatMessages = chats[activeChatId].messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          model: selectedModel,
          temperature: 0.7,
          max_tokens: -1,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || "Entschuldigung, ich habe keine Antwort erhalten.";

      setIsTyping(false);

      // AI-Antwort hinzufügen
      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, assistantMessage]
        }
      }));

      // Bei angemeldeten Benutzern auch auf Server speichern
      if (!isGuestMode) {
        try {
          await axios.post(`${API}/chats/${activeChatId}/messages`, assistantMessage, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }

      // Chat-Titel aktualisieren (nur bei ersten Nachrichten)
      if (chats[activeChatId].messages.length === 2) {
        updateChatTitle(activeChatId, message);
      }

    } catch (error) {
      setIsTyping(false);
      const errorMessage = {
        role: 'assistant',
        content: `🚫 Fehler: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, errorMessage]
        }
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateChatTitle = async (chatId, content) => {
    let title = content.split('.')[0].substring(0, 50);
    if (title.length === 50) title += '...';
    if (title.trim() === '') title = 'Ohne Titel';

    setChats(prev => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        title: title
      }
    }));

    if (!isGuestMode) {
      try {
        await axios.put(`${API}/chats/${chatId}`, {
          title: title
        }, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (error) {
        console.error('Error updating chat title:', error);
      }
    }
  };

  // Auto-scroll zu neuen Nachrichten
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats, activeChatId, isTyping]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center z-50">
        <i className="fas fa-spinner text-5xl text-orange-500 animate-spin mb-4"></i>
        <div className="text-lg text-gray-600">Verbinde mit Mr Ermin API...</div>
      </div>
    );
  }

  // Login Overlay
  if (showLogin) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-7 rounded-xl max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-orange-500 mb-2">Bitte einloggen</h2>
          <p className="text-gray-700 mb-3">
            Melde dich an, um den Chat nutzen zu können. Wir verwenden Google Login zur sicheren Authentifizierung.
          </p>
          
          <div className="mb-4">
            <GoogleSignIn onCredentialResponse={handleGoogleCredential} />
          </div>
          
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input 
                type="checkbox" 
                checked={consentGiven} 
                onChange={(e) => setConsentGiven(e.target.checked)}
              />
              Ich stimme der <a href="/privacy.html" target="_blank" className="text-blue-600 underline">Datenschutzerklärung</a> und der Speicherung meiner E‑Mail zu.
            </label>
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleGuestMode}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Als Gast fortfahren
            </button>
            <button
              onClick={handleLogin}
              disabled={!currentUser || !consentGiven}
              className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fortfahren
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
            Hinweis: Der API-Endpunkt ist verborgen, damit er nicht missbraucht werden kann. 
            Ihre Anfragen werden datenschutzkonform verarbeitet.
          </p>
        </div>
      </div>
    );
  }

  const activeChat = chats[activeChatId];

  return (
    <div className="h-screen bg-orange-50 text-gray-900 flex">
      {/* Sidebar */}
      <div className="w-64 bg-orange-50 flex flex-col border-r-4 border-orange-500">
        {/* Logo */}
        <div className="flex items-center justify-center p-5 bg-white border-b-2 border-orange-500">
          <img src="/logo.png" alt="Mr Ermin Logo" className="max-w-[140px] h-auto" />
        </div>

        {/* Neuer Chat Button */}
        <button
          onClick={createNewChat}
          className="bg-orange-500 text-white border-none p-3 m-4 rounded-2xl font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors"
        >
          <i className="fas fa-plus"></i>
          <span>Neuer Chat</span>
        </button>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4">
          {Object.entries(chats)
            .sort(([,a], [,b]) => new Date(b.messages[b.messages.length - 1]?.timestamp || 0) - new Date(a.messages[a.messages.length - 1]?.timestamp || 0))
            .map(([chatId, chat]) => (
            <ChatHistoryItem
              key={chatId}
              chat={chat}
              isActive={chatId === activeChatId}
              onClick={() => setActiveChatId(chatId)}
              onDelete={() => deleteChat(chatId)}
            />
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="bg-white bg-opacity-80 p-3 rounded-2xl text-sm mb-3">
            <div className="font-bold text-orange-500 mb-1">Mr Ermin AI</div>
            <div className="text-gray-600 text-xs">Kreativmodus • Optimiert für Dialog</div>
          </div>

          {/* Model Selector */}
          <div className="bg-white p-3 rounded-2xl border border-gray-200 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modell auswählen:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
              disabled={availableModels.length === 0}
            >
              {availableModels.length === 0 ? (
                <option value="">Lade Modelle...</option>
              ) : (
                availableModels.map(model => (
                  <option key={model.id} value={model.id}>{model.id}</option>
                ))
              )}
            </select>
          </div>

          {/* User Info */}
          {currentUser && !isGuestMode && (
            <div className="bg-gray-100 p-3 rounded-2xl text-xs border border-gray-200">
              <div className="font-bold">👤 Angemeldet als:</div>
              <div className="flex items-center gap-2 mt-1">
                {currentUser.picture && (
                  <img src={currentUser.picture} alt={currentUser.name} className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <div>{currentUser.name}</div>
                  <div className="text-gray-600">{currentUser.email}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 text-white text-xs px-2 py-1 rounded mt-2 hover:bg-red-600"
              >
                Ausloggen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b-4 border-orange-500 flex items-center justify-between bg-orange-50">
          <div className="text-xl font-bold text-orange-500">
            {activeChat?.title || 'Willkommen bei Mr Ermin'}
          </div>
        </div>

        {/* Chat Container */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 bg-white"
        >
          {activeChat?.messages.map((message, index) => (
            <ChatMessage 
              key={index} 
              message={message} 
              isUser={message.role === 'user'} 
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>

        {/* Input Container */}
        <div className="p-5 bg-orange-50">
          <div className="bg-orange-100 rounded-2xl p-4 flex items-center gap-3">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Nachricht eingeben..."
              disabled={isGenerating}
              className="flex-1 bg-transparent border-none text-gray-900 text-base resize-none outline-none"
              rows="1"
            />
            <button
              onClick={sendMessage}
              disabled={isGenerating || !messageInput.trim()}
              className="bg-orange-500 border-none text-white w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
          <div className="flex justify-between mt-2 text-gray-600 text-xs">
            <div className="text-orange-500 font-semibold">© Mr Ermin – Gute Ideen, gute Antworten</div>
            <div>Shift + Enter für neue Zeile</div>
          </div>
        </div>
      </div>
    </div>
  );
}