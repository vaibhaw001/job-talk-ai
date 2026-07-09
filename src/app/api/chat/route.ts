import { NextResponse } from 'next/server';
// Polyfill for pdf-parse which requires DOMMatrix in newer Node versions
const PDFParser = require('pdf2json');

const parsePdf = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      const text = pdfData.Pages.map((page: any) => 
        page.Texts.map((text: any) => decodeURIComponent(text.R[0].T)).join(" ")
      ).join("\n");
      resolve(text);
    });
    pdfParser.parseBuffer(buffer);
  });
};

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
    if (file) {
      if (file.extractedText) {
        extractedText = file.extractedText;
      } else if (file.base64) {
        const buffer = Buffer.from(file.base64, 'base64');
        if (file.type === 'application/pdf') {
          extractedText = await parsePdf(buffer);
        } else {
          // Assume text file
          extractedText = buffer.toString('utf-8');
        }
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

    // Gemini API requires the conversation to start with a 'user' message.
    // We strip any initial 'ai' messages (like the greeting).
    let startIndex = 0;
    while (startIndex < history.length && history[startIndex].role === 'ai') {
      startIndex++;
    }
    
    const isOpenRouter = apiKey.startsWith('sk-or-');

    let response;
    
    if (isOpenRouter) {
      // Format History for OpenRouter (OpenAI standard)
      const orMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(startIndex).map((msg: any) => {
          let contentText = msg.content;
          if (msg === history[history.length - 1] && extractedText) {
            contentText += `\n\n--- UPLOADED DOCUMENT CONTENT ---\n${extractedText}`;
          }
          return {
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: contentText
          };
        })
      ];

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Jobs Voice AI'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: orMessages,
          temperature: 0.7,
          max_tokens: 250
        })
      });
    } else {
      // Format History for Native Gemini API
      const contents = history.slice(startIndex).map((msg: any) => {
        let contentText = msg.content;
        if (msg === history[history.length - 1] && extractedText) {
          contentText += `\n\n--- UPLOADED DOCUMENT CONTENT ---\n${extractedText}`;
        }
        return {
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: contentText }]
        };
      });

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 250,
            }
          })
        }
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      require('fs').writeFileSync('gemini-error.log', errorData);
      throw new Error('Failed to generate response from API');
    }

    const data = await response.json();
    let reply = "I'm sorry, I couldn't process that.";
    
    if (isOpenRouter) {
      reply = data.choices?.[0]?.message?.content || reply;
    } else {
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || reply;
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    require('fs').writeFileSync('chat-error.log', error.stack || error.toString());
    return NextResponse.json(
      { error: 'Failed to process chat or file' },
      { status: 500 }
    );
  }
}
