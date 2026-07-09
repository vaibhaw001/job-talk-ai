"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Briefcase, Loader2, Square, Paperclip, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello! I'm your AI Career Advisor. Ready for a mock interview or some career advice?" }
  ]);
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
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

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    
    const msg = textInput.trim();
    setTextInput('');
    handleProcessMessage(msg, false); // false = don't speak text chats out loud
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
          file: fileData
        }),
      });
      
      if (!res.ok) throw new Error('API Request failed');
      
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
      
      if (speakAloud) {
        speakText(data.reply);
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

  const extractPdfText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
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
        type: 'text/plain' // Masquerade as plain text to skip backend processing
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

  return (
    <main className="h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-hidden relative flex flex-col">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-sky-500/5 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white leading-tight">Aura</h1>
            <p className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase">Career Advisor</p>
          </div>
        </div>
      </header>

      {/* Chat History Area */}
      <div className="flex-1 relative z-10 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth">
        <div className="max-w-3xl mx-auto w-full space-y-8">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col space-y-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'ai' && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 font-medium">
                    <Settings className="w-3 h-3" /> Aura AI
                  </div>
                )}
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white shadow-[0_4px_20px_-10px_rgba(37,99,235,0.4)] rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-slate-200 shadow-xl shadow-black/20 backdrop-blur-sm rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
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

          {/* Voice Record Button */}
          <button
             onClick={toggleRecording}
             disabled={isProcessing}
             className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500 shadow-xl ${
               isRecording 
                 ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                 : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30'
             } disabled:opacity-50 disabled:pointer-events-none`}
           >
              {isRecording ? (
                <Square className="w-6 h-6 fill-current" />
              ) : (
                <Mic className="w-6 h-6 fill-current" />
              )}
           </button>
        </div>
      </div>
    </main>
  );
}
