# JobTalk - Voice Career Advisor

JobTalk is a modern, real-time multimodal AI Career Advisor built with Next.js, Tailwind CSS, and the Google Gemini API. It acts as an expert Senior Technical Recruiter, allowing you to participate in highly realistic mock interviews and get instant feedback on your resume.

## Features

- 🎙️ **Voice Recognition & Speech**: Talk naturally to the AI using your microphone. The AI will respond out loud with conversational inflections.
- 💬 **Multimodal Chat UI**: A sleek, dark blue interface that tracks your conversation history and allows you to type if you prefer not to speak.
- 📄 **Resume Parsing**: Upload your resume in `.pdf`, `.txt`, or `.md` formats. The backend leverages `pdf-parse` to read your document and the Gemini API provides actionable feedback on your quantifiable achievements.
- 🎨 **Modern Aesthetics**: A premium UI featuring glassmorphism, responsive animations, and deep-blue ambient glows.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS, Lucide React (Icons)
- **Backend**: Next.js Serverless Route (`/api/chat`)
- **AI Integration**: Google Gemini 2.5 Flash API
- **Document Parsing**: `pdf-parse`
- **Voice APIs**: Web Speech API (`SpeechRecognition` and `SpeechSynthesis`)

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vaibhaw001/job-talk-ai.git
   cd "job-talk-ai"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root of the project and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Browser Support
For the best experience, especially regarding the Voice functionality (Web Speech API), please use Google Chrome or Microsoft Edge.

## License
MIT
