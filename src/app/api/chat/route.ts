import { NextResponse } from 'next/server';
const pdfParse = require('pdf-parse');

const SYSTEM_PROMPT = "You are an expert AI Career Advisor and Senior Technical Recruiter. You are interacting with candidates over a multimodal chat.\\n\\n" +
"Your goal is to provide accurate career information, detail hiring processes, and conduct highly realistic mock interviews.\\n" +
"If the user uploads a resume, review it professionally, offering actionable feedback on quantifiable achievements, formatting, and impact.\\n\\n" +
"CONVERSATION RULES (CRITICAL):\\n" +
"- Keep responses CONCISE. Aim for 1-4 short sentences per turn.\\n" +
"- DO NOT use markdown, bullet points, asterisks, or special formatting unless strictly necessary for readability.\\n" +
"- Speak naturally. You are a real, professional recruiter and advisor.\\n" +
"- If the user asks for a mock interview, ask one question at a time and wait for their response. Do not ask multi-part questions all at once.";

export async function POST(req: Request) {
  try {
    const { history, file } = await req.json();

    let extractedText = '';

    // Handle File Upload Parsing
    if (file && file.base64) {
      const buffer = Buffer.from(file.base64, 'base64');
      if (file.type === 'application/pdf') {
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } else {
        // Assume text file
        extractedText = buffer.toString('utf-8');
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Fallback to mock logic if no API key is provided
    if (!apiKey) {
       console.log("No GEMINI_API_KEY found, falling back to mock response.");
       const latestMsg = history[history.length - 1].content.toLowerCase();
       let reply = "I don't have my API key right now to process that deeply. ";
       
       if (file) {
         reply = `I see you uploaded "${file.name}". Once the Gemini API key is configured, I can review this resume in detail!`;
       } else if (latestMsg.includes('hello')) {
         reply = "Hello! I am ready to help you with your career goals.";
       } else if (latestMsg.includes('interview')) {
         reply = "Great to have you here. Let's get started. What specific role are you interviewing for today?";
       } else {
         reply += "What's the biggest challenge you're facing in your job search right now?";
       }
       return NextResponse.json({ reply });
    }

    // Format History for Gemini API
    const contents = history.map((msg: any) => {
      let contentText = msg.content;
      // Inject extracted file text into the latest user message
      if (msg === history[history.length - 1] && extractedText) {
        contentText += `\n\n--- UPLOADED DOCUMENT CONTENT ---\n${extractedText}`;
      }
      return {
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: contentText }]
      };
    });

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API Error:', errorData);
      throw new Error('Failed to generate response from Gemini');
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat or file' },
      { status: 500 }
    );
  }
}
