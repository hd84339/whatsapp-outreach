import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import "./App.css";

function App() {
  const [numbersText, setNumbersText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [prompt, setPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "model", text: "Hello! I am your AI outreach assistant. Ask me to add contacts, delete them, or send WhatsApp messages!" }
  ]);

  const [inboxMessages, setInboxMessages] = useState([]);
  const [botStatus, setBotStatus] = useState('starting');
  const [qrCode, setQrCode] = useState('');
  // Load contacts from DB on mount
  useEffect(() => {
    fetchContacts();
    fetchInbox();
    // Auto-refresh inbox every 5 seconds
    const inboxInterval = setInterval(fetchInbox, 5000);
    
    // Poll WhatsApp Bot Status
    const checkBotStatus = async () => {
      try {
        const res = await fetch("http://localhost:3001/qr");
        const data = await res.json();
        setBotStatus(data.status);
        if (data.qr) setQrCode(data.qr);
      } catch (error) {
        setBotStatus('offline');
      }
    };
    checkBotStatus();
    const botInterval = setInterval(checkBotStatus, 3000);

    return () => {
        clearInterval(inboxInterval);
        clearInterval(botInterval);
    };
  }, []);

  const fetchInbox = async () => {
    try {
      const response = await fetch("http://localhost:8000/messages");
      const data = await response.json();
      setInboxMessages(data);
    } catch (error) {
      console.error("Failed to load inbox:", error);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch("http://localhost:8000/contacts");
      const data = await response.json();
      setContacts(data);
      // Select all by default
      setSelectedPhones(new Set(data.map(c => c.phone)));
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }
  };

  const syncWhatsAppContacts = async () => {
    try {
      const response = await fetch("http://localhost:3001/contacts");
      const data = await response.json();
      
      if (data.contacts && data.contacts.length > 0) {
        // Save them to our database
        await fetch("http://localhost:8000/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: data.contacts }),
        });
        alert(`Successfully synced ${data.contacts.length} contacts from WhatsApp!`);
        fetchContacts(); // Refresh list
      }
    } catch (error) {
      alert("Error syncing contacts. Make sure the Node bot is running on port 3001.");
    }
  };

  const processNumbers = async () => {
    const rawLines = numbersText.split(/[\n]+/).map((line) => line.trim()).filter(Boolean);
    const parsedContacts = [];
    
    rawLines.forEach((line) => {
      const parts = line.split(',');
      let name = "", phoneRaw = "";
      if (parts.length >= 2) {
        name = parts[0].trim();
        phoneRaw = parts[1].trim();
      } else {
        const numMatch = line.match(/(\+?\d[\d\s-]{8,})/);
        if (numMatch) {
            phoneRaw = numMatch[0];
            name = line.replace(phoneRaw, "").trim();
        } else {
            phoneRaw = line;
        }
      }
      const phone = phoneRaw.replace(/\D/g, "");
      if (phone.length >= 10) parsedContacts.push({ name: name || "Unknown", phone });
    });

    try {
      await fetch("http://localhost:8000/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: parsedContacts }),
      });
      setNumbersText("");
      fetchContacts();
    } catch (error) {
      alert("Error saving pasted contacts.");
    }
  };

  const toggleSelect = (phone) => {
    const newSelected = new Set(selectedPhones);
    if (newSelected.has(phone)) newSelected.delete(phone);
    else newSelected.add(phone);
    setSelectedPhones(newSelected);
  };

  const selectAll = () => {
    setSelectedPhones(new Set(contacts.map(c => c.phone)));
  };

  const deselectAll = () => {
    setSelectedPhones(new Set());
  };

  const sendBulkMessages = async () => {
    if (!prompt) return alert("Please enter a message prompt first.");
    if (selectedPhones.size === 0) return alert("Please select at least one contact.");
    
    try {
      const response = await fetch("http://localhost:8000/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            prompt,
            numbers: Array.from(selectedPhones) 
        }),
      });
      
      const data = await response.json();
      const sent = data.results.filter(r => r.status === "sent").length;
      alert(`Sent ${sent} messages out of ${selectedPhones.size}`);
    } catch (error) {
      alert("Failed to send messages.");
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: userMsg }]);
    
    try {
        const response = await fetch("http://localhost:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMsg })
        });
        const data = await response.json();
        setChatHistory(prev => [...prev, { role: "model", text: data.reply }]);
        
        // Refresh contacts just in case the agent modified the DB!
        fetchContacts();
    } catch (error) {
        setChatHistory(prev => [...prev, { role: "model", text: "Error communicating with backend." }]);
    }
  };

  const downloadVCard = () => window.location.href = "http://localhost:8000/export-vcard";

  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <div className="dashboard-container">
      <header>
        <h1>WhatsApp Outreach</h1>
        <p>Manage your contacts, handle replies, and broadcast AI messages.</p>
        
        {/* Connection Status Banner */}
        <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: botStatus === 'ready' ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 159, 67, 0.1)', border: `1px solid ${botStatus === 'ready' ? 'var(--accent-primary)' : '#ff9f43'}` }}>
          <h3 style={{ margin: 0, color: botStatus === 'ready' ? 'var(--accent-primary)' : '#ff9f43' }}>
            {botStatus === 'ready' ? '✅ WhatsApp Bot Connected' : botStatus === 'offline' ? '❌ Bot Server Offline' : botStatus === 'pending' ? '📱 Scan QR to Connect' : '⏳ Starting Bot...'}
          </h3>
          
          {botStatus === 'pending' && qrCode && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '8px' }}>
              <QRCodeSVG value={qrCode} size={220} />
            </div>
          )}
          {botStatus === 'offline' && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Please start the node.js server (node index.js)</p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
          <button className={activeTab === 'contacts' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('contacts')} style={{ width: 'auto', marginTop: 0 }}>
            👥 Contacts & Broadcast
          </button>
          <button className={activeTab === 'inbox' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('inbox')} style={{ width: 'auto', marginTop: 0 }}>
            📥 Inbox (Replies)
          </button>
          <button className={activeTab === 'ai' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('ai')} style={{ width: 'auto', marginTop: 0 }}>
            ✨ AI Assistant
          </button>
        </div>
      </header>

      {activeTab === 'contacts' && (
        <>
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }} className="glass-panel">
              <h3>Add New Contacts</h3>
              <textarea
                className="input-area"
                style={{ minHeight: "120px" }}
                value={numbersText}
                onChange={(e) => setNumbersText(e.target.value)}
                placeholder="John Doe, 9876543210&#10;Alice 9123456789"
              />
              <button className="btn-secondary" onClick={processNumbers} style={{width: '100%'}}>➕ Save Contacts</button>
            </div>

            <div style={{ flex: '1 1 400px' }} className="glass-panel">
              <h3>🤖 AI Message Broadcaster</h3>
              <textarea
                className="input-area"
                style={{ minHeight: "120px", marginBottom: "1rem" }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type your message prompt here. We'll automatically insert 'Hey [Name]!'"
              />
              <button className="btn-primary" onClick={sendBulkMessages}>
                🚀 Send to {selectedPhones.size} Selected
              </button>
            </div>
          </div>

          <hr style={{ margin: '3rem 0', borderColor: 'var(--glass-border)' }} />

          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>Your Master Contact List ({contacts.length})</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={syncWhatsAppContacts}>🔄 Sync from Phone</button>
                <button className="btn-outline" onClick={downloadVCard}>⬇️ Download vCard</button>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', marginBottom: '1rem', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-outline" onClick={selectAll}>✅ Select All</button>
                  <button className="btn-outline" onClick={deselectAll}>❌ Deselect All</button>
                </div>
                
                <input 
                  type="text" 
                  className="search-input"
                  placeholder="🔍 Search by name or number..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="contacts-list" style={{ marginTop: '1rem' }}>
              {contacts.filter(c => 
                (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (c.phone && c.phone.includes(searchQuery))
              ).map((contact, index) => (
                <div className="contact-item" key={contact.phone}>
                  <input 
                    type="checkbox" 
                    checked={selectedPhones.has(contact.phone)} 
                    onChange={() => toggleSelect(contact.phone)}
                  />
                  <span className="contact-index">{index + 1}.</span>
                  <span className="contact-name" style={{ fontWeight: "600", fontSize: "1.1rem" }}>
                    {contact.name !== "Unknown" ? contact.name : "No Name"}
                  </span>
                  <span className="contact-number" style={{ color: "var(--text-secondary)" }}>{contact.phone}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'inbox' && (
        <div className="glass-panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>📥 Inbox</h2>
            <button className="btn-secondary" style={{ width: 'auto', marginTop: 0 }} onClick={fetchInbox}>🔄 Refresh</button>
          </div>
          <p>Incoming WhatsApp replies from your contacts appear here in real-time.</p>
          <div className="contacts-list" style={{ flex: 1, overflowY: 'auto' }}>
            {inboxMessages.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>No new messages yet.</span>
            ) : (
              inboxMessages.map((msg) => (
                <div key={msg.id} className="contact-item" style={{ flexDirection: 'column', alignItems: 'flex-start', background: 'var(--input-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{msg.sender_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em', fontWeight: 'normal' }}>({msg.sender_phone})</span></span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{msg.timestamp}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <h2>✨ AI Assistant (Gemini)</h2>
          <p>Talk to Gemini to manage your dashboard naturally. Try saying: "Add 9876543210 to my contacts" or "Send a hello message to 9876543210".</p>
          
          <div style={{ flex: 1, backgroundColor: 'var(--input-bg)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto', marginBottom: '1rem', gap: '1rem' }}>
             {chatHistory.map((msg, i) => (
                 <div key={i} style={{ 
                     alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                     backgroundColor: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--glass-panel)',
                     padding: '10px 15px',
                     borderRadius: '12px',
                     maxWidth: '80%',
                     border: msg.role === 'model' ? '1px solid var(--glass-border)' : 'none',
                     whiteSpace: 'pre-wrap',
                     lineHeight: '1.5'
                 }}
                 dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }}
                 />
             ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                  type="text" 
                  className="search-input" 
                  style={{ maxWidth: '100%', flex: 1 }} 
                  placeholder="Ask Gemini to do something..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
              />
              <button className="btn-primary" style={{ width: 'auto', margin: 0 }} onClick={handleChatSubmit}>
                  Send
              </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
