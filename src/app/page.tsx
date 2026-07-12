"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Briefcase, Loader2, Square, Paperclip, Send, Plus, MessageSquare, Menu, X, Trash2, Camera, CameraOff, Copy, FileText, Check, Download } from 'lucide-react';
import jsPDF from 'jspdf';

interface Message {
  role: 'user' | 'ai';
  content: string;
  revisedDoc?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

const DEFAULT_MESSAGE: Message = { role: 'ai', content: "Hello! I'm your AI Career Advisor. Ready for a mock interview or some career advice?" };

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Camera state
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<any>(null);
  
  // Load chat history on mount
  useEffect(() => {
    const saved = localStorage.getItem('jobtalk_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChatHistory(parsed);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
  }, []);

  // Save chat history whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('jobtalk_history', JSON.stringify(chatHistory));
    } else {
      localStorage.removeItem('jobtalk_history');
    }
  }, [chatHistory]);

  // Update current session in history whenever messages change (if we have a current session or need to create one)
  useEffect(() => {
    if (messages.length <= 1 && messages[0]?.content === DEFAULT_MESSAGE.content) return; // Don't save empty default chats
    
    setChatHistory(prev => {
      const existingIdx = prev.findIndex(c => c.id === currentChatId);
      const title = messages.find(m => m.role === 'user')?.content.slice(0, 30) + '...' || 'New Chat';
      
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], messages, updatedAt: Date.now() };
        // Sort by updatedAt descending
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      } else {
        // Create new session
        const newId = Date.now().toString();
        setCurrentChatId(newId);
        const newSession: ChatSession = { id: newId, title, updatedAt: Date.now(), messages };
        return [newSession, ...prev];
      }
    });
  }, [messages, currentChatId]);
  
  // Refs to access latest state in speech recognition events
  const stateRefs = useRef({
    isRecording: false,
    transcript: '',
    interimTranscript: ''
  });

  useEffect(() => {
    stateRefs.current = { isRecording, transcript, interimTranscript };
  }, [isRecording, transcript, interimTranscript]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript, interimTranscript]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let final = '';
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (final.trim()) {
             setTranscript(prev => prev + final);
          }
          setInterimTranscript(interim);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          const state = stateRefs.current;
          if (state.isRecording) {
            setIsRecording(false);
            const fullTranscript = (state.transcript + ' ' + state.interimTranscript).trim();
            if (fullTranscript) {
              if (processRef.current) {
                processRef.current(fullTranscript, true);
              }
            }
          }
        };
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      // Cleanup camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      const fullTranscript = (transcript + ' ' + interimTranscript).trim();
      if (fullTranscript) {
        handleProcessMessage(fullTranscript, true); // true = speak response aloud
      }
    } else {
      setTranscript('');
      setInterimTranscript('');
      if (recognitionRef.current) {
         try {
           recognitionRef.current.start();
           setIsRecording(true);
           window.speechSynthesis.cancel();
         } catch (e) {
           console.error(e);
         }
      }
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsVideoEnabled(true);
    } catch (err) {
      console.error("Error accessing camera: ", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoEnabled(false);
  };

  const toggleCamera = () => {
    if (isVideoEnabled) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    
    const msg = textInput.trim();
    setTextInput('');
    handleProcessMessage(msg, false); 
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const preferredVoice = englishVoices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural')) || englishVoices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleProcessMessage = async (text: string, speakAloud: boolean = false, fileData: { extractedText?: string, base64?: string, name: string, type: string } | null = null) => {
    if (!text.trim() && !fileData) return;
    
    // Capture video frame if camera is on
    let imageData = null;
    if (isVideoEnabled && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          imageData = dataUrl.split(',')[1];
        }
      } catch (e) {
        console.error("Failed to capture video frame", e);
      }
    }

    // Add user message to UI immediately
    let displayContent = text;
    if (fileData) {
      displayContent = `[Uploaded File: ${fileData.name}]\n\n${text}`;
    }
    
    const newMessages = [...messages, { role: 'user' as const, content: displayContent }];
    setMessages(newMessages);
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: newMessages,
          file: fileData,
          imageData
        }),
      });
      
      if (!res.ok) throw new Error('API Request failed');
      
      const data = await res.json();
      let aiReply = data.reply;
      let revisedDocStr = undefined;
      
      const docMatch = aiReply.match(/\[REWRITTEN_DOC\]([\s\S]*?)\[\/REWRITTEN_DOC\]/);
      if (docMatch) {
         revisedDocStr = docMatch[1].trim();
         aiReply = aiReply.replace(/\[REWRITTEN_DOC\][\s\S]*?\[\/REWRITTEN_DOC\]/g, '').trim();
      }
      
      if (aiReply.includes('[START_VIDEO]')) {
        aiReply = aiReply.replace(/\[START_VIDEO\]/g, '').trim();
        startCamera();
      }
      
      setMessages(prev => [...prev, { role: 'ai', content: aiReply, revisedDoc: revisedDocStr }]);
      
      if (speakAloud) {
        speakText(aiReply);
      }
    } catch (error) {
      console.error(error);
      const fallbackMsg = "I'm having trouble connecting right now. Let's try again in a moment.";
      setMessages(prev => [...prev, { role: 'ai', content: fallbackMsg }]);
      if (speakAloud) speakText(fallbackMsg);
    } finally {
      setIsProcessing(false);
      setTranscript('');
      setInterimTranscript('');
    }
  };

  useEffect(() => {
    processRef.current = handleProcessMessage;
  }, [handleProcessMessage]);

  const extractPdfText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        processPdf();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = processPdf;
      script.onerror = reject;
      document.body.appendChild(script);

      async function processPdf() {
        try {
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          resolve(text);
        } catch (e) {
          reject(e);
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        extractedText = await extractPdfText(file);
      } else {
        extractedText = await file.text();
      }

      await handleProcessMessage('Please review this document.', false, {
        extractedText,
        name: file.name,
        type: 'text/plain' 
      });
    } catch (error) {
      console.error('File extraction error:', error);
      const fallbackMsg = "I couldn't read that file. Could you try again?";
      setMessages(prev => [...prev, { role: 'ai', content: fallbackMsg }]);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([DEFAULT_MESSAGE]);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const loadChat = (session: ChatSession) => {
    setCurrentChatId(session.id);
    setMessages(session.messages);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      startNewChat();
    }
  };

  const handleDownloadDocument = (text: string) => {
    let fileName = 'revised-document.txt';
    let isPdf = false;
    
    // Find the most recently uploaded file in the chat history
    for (let i = messages.length - 1; i >= 0; i--) {
      const match = messages[i].content.match(/\[Uploaded File: (.+?)\]/);
      if (match) {
        fileName = match[1];
        if (fileName.toLowerCase().endsWith('.pdf')) {
           isPdf = true;
        }
        break;
      }
    }

    const downloadName = `AI_Revised_${fileName}`;

    if (isPdf) {
      try {
        const doc = new jsPDF();
        const splitText = doc.splitTextToSize(text, 180);
        
        let y = 15;
        for (let i = 0; i < splitText.length; i++) {
          if (y > 280) {
            doc.addPage();
            y = 15;
          }
          doc.text(splitText[i], 15, y);
          y += 7;
        }
        
        doc.save(downloadName);
      } catch (err) {
        console.error("Failed to generate PDF", err);
        // Fallback to text
        downloadAsText(text, downloadName.replace('.pdf', '.txt'));
      }
    } else {
      downloadAsText(text, downloadName);
    }
  };

  const downloadAsText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') || filename.endsWith('.md') ? filename : filename + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 h-full w-72 flex flex-col bg-slate-900/80 backdrop-blur-xl border-r border-white/5 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">JobTalk</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-600/20 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New Interview
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
          <div className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Previous Chats</div>
          {chatHistory.length === 0 ? (
            <div className="px-2 py-4 text-sm text-slate-500 italic">No previous chats</div>
          ) : (
            chatHistory.map(session => (
              <div 
                key={session.id}
                onClick={() => loadChat(session)}
                className={`group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${currentChatId === session.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-slate-300'}`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                <div className="flex-1 truncate text-sm">{session.title}</div>
                <button 
                  onClick={(e) => deleteChat(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-all shrink-0"
                  title="Delete Chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-sky-500/5 blur-[150px]" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white leading-tight">JobTalk</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase">Career Advisor</p>
            </div>
          </div>
        </header>

        {/* Camera Floating Box */}
        {isVideoEnabled && (
          <div className="absolute top-20 right-8 z-30 w-48 h-36 md:w-64 md:h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 shadow-black/50 animate-in fade-in slide-in-from-top-4 duration-500">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover scale-x-[-1]" 
            />
            <button 
              onClick={stopCamera}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500/80 backdrop-blur-md rounded-lg text-white transition-colors"
              title="Close Camera"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chat History Area */}
        <div className="flex-1 relative z-10 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full space-y-8">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col space-y-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 font-medium">
                      <Settings className="w-3 h-3" /> JobTalk
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-[0_4px_20px_-10px_rgba(37,99,235,0.4)] rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 text-slate-200 shadow-xl shadow-black/20 backdrop-blur-sm rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.revisedDoc && (
                    <div className="w-full mt-2 bg-slate-900/50 border border-emerald-500/30 rounded-xl overflow-hidden shadow-lg shadow-emerald-900/20 backdrop-blur-sm animate-in slide-in-from-top-2">
                      <div className="bg-emerald-500/10 px-4 py-2 border-b border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                          <FileText className="w-4 h-4" /> AI Revised Document
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleDownloadDocument(msg.revisedDoc!)}
                            className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/40 px-2 py-1 rounded transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(msg.revisedDoc!);
                              const btn = document.activeElement as HTMLElement;
                              if (btn) {
                                const original = btn.innerHTML;
                                btn.innerHTML = 'Copied!';
                                setTimeout(() => btn.innerHTML = original, 2000);
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/40 px-2 py-1 rounded transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </button>
                        </div>
                      </div>
                      <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{msg.revisedDoc}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Active Voice Transcript Bubble */}
            {(transcript || interimTranscript) && (
               <div className="flex w-full justify-end">
                 <div className="flex flex-col space-y-2 max-w-[80%] items-end opacity-70 animate-pulse">
                   <div className="p-4 rounded-2xl bg-blue-600/50 text-white border border-blue-500/30 rounded-tr-none">
                     <p className="whitespace-pre-wrap leading-relaxed italic">
                       {transcript} <span className="text-white/60">{interimTranscript}</span>
                     </p>
                   </div>
                 </div>
               </div>
            )}
            
            {/* Typing Indicator */}
            {isProcessing && (
              <div className="flex w-full justify-start">
                 <div className="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-tl-none flex gap-2 items-center">
                   <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                 </div>
              </div>
            )}
            <div ref={chatEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="relative z-10 w-full px-4 pb-6 pt-2 shrink-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
          <div className="max-w-3xl mx-auto flex items-end gap-3 relative">
            
            {/* Text & Upload Input */}
            <form onSubmit={handleTextSubmit} className="flex-1 bg-white/5 border border-white/10 rounded-3xl flex items-center p-1.5 focus-within:border-blue-500/50 focus-within:bg-white/10 transition-all duration-300 backdrop-blur-xl shadow-lg shadow-black/20">
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt,.md,.docx" onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                title="Upload Resume"
                disabled={isProcessing}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message or upload your resume..."
                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-500 px-2"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isProcessing}
                className="p-3 text-blue-400 hover:text-white hover:bg-blue-600 rounded-full transition-colors disabled:opacity-30"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            <div className="flex gap-2">
              {/* Camera Toggle Button */}
              <button
                 onClick={toggleCamera}
                 disabled={isProcessing}
                 className={`shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 shadow-lg ${
                   isVideoEnabled 
                     ? 'bg-slate-700 text-white hover:bg-slate-600 shadow-black/20' 
                     : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white shadow-black/20'
                 } disabled:opacity-50`}
                 title="Toggle Camera"
               >
                  {isVideoEnabled ? (
                    <CameraOff className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Camera className="w-5 h-5 md:w-6 md:h-6" />
                  )}
              </button>

              {/* Voice Record Button */}
              <button
                 onClick={toggleRecording}
                 disabled={isProcessing}
                 className={`shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-500 shadow-xl ${
                   isRecording 
                     ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                     : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30'
                 } disabled:opacity-50 disabled:pointer-events-none`}
                 title="Toggle Microphone"
               >
                  {isRecording ? (
                    <Square className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                  ) : (
                    <Mic className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                  )}
               </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
