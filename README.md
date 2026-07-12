# JobTalk - Voice & Vision AI Career Advisor

JobTalk is a modern, real-time multimodal AI Career Advisor built with Next.js, Tailwind CSS, and the Google Gemini API. It acts as an expert Senior Technical Recruiter, allowing you to participate in highly realistic mock interviews, get instant feedback on your resume, and practice your non-verbal communication through AI vision.

## ✨ Core Features

- 🎙️ **Voice Recognition & Speech Synthesis**: Talk naturally to the AI using your microphone. The AI processes your speech and responds out loud with conversational inflections.
- 👁️ **Multimodal Vision Analysis**: The AI interviewer can "see" you! During an interview, the app captures snapshots of your camera feed and securely streams them to the AI to analyze your body language, eye contact, and facial expressions in real-time.
- 📝 **Chat History & Sessions**: Seamlessly switch between different mock interviews. Your conversations are automatically saved locally in a sleek, glassmorphic sidebar.
- 📄 **Resume Parsing**: Upload your resume in `.pdf`, `.txt`, or `.md` formats. The backend leverages `pdf-parse` to read your document and the Gemini API provides actionable feedback on your quantifiable achievements.
- 🤖 **Agentic Control**: The AI completely manages the flow of the interview. If you ask to start an interview, the AI autonomously triggers the activation of your webcam.
- 🎨 **Premium Aesthetics**: A stunning, responsive dark-mode UI featuring glassmorphism, animated ambient glows, typing indicators, and a pulsing voice-transcription UI.

## 🛠️ Tech Stack

- **Frontend Framework**: Next.js 16 (App Router), React
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Next.js Serverless Route (`/api/chat`)
- **AI Integration**: Google Gemini 2.5 Flash API (Supports both Native Google API and OpenRouter)
- **Document Parsing**: `pdf-parse` (Server-side), `pdf.js` (Client-side fallback)
- **Browser APIs**: Web Speech API (`SpeechRecognition` and `SpeechSynthesis`), MediaDevices API (`getUserMedia`, `<canvas>` snapshotting)

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vaibhaw001/job-talk-ai.git
   cd job-talk-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root of the project and add your Gemini API Key. You can use a native Google API key or an OpenRouter API key (`sk-or-...`).
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📸 Using the Vision Features

To use the camera and vision analysis capabilities:
1. Ensure you are on a supported browser that allows `getUserMedia`.
2. Click the microphone and say **"Take my interview"** (or type it).
3. The AI will respond, and its response will automatically trigger the activation of your webcam!
4. Answer the AI's questions while keeping the camera on; it will analyze your posture and expressions.

## 🌐 Browser Support
For the best experience, especially regarding the Voice functionality (Web Speech API) and Camera access, please use **Google Chrome** or **Microsoft Edge**.

## 📝 License
MIT
