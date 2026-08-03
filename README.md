# Ghost Coach 👻 🎙️

Ghost Coach is a lightweight, frameless, and transparent desktop application designed to feed real-time guidance, AI coaching prompts, and a scrolling teleprompter to presenters, interviewees, or public speakers. It floats seamlessly on top of all windows and workspaces (including macOS full-screen apps) without grabbing focus, providing an unobtrusive way to receive live assistance.

---

## 💡 The Problem: High-Stakes Presentations & Interviews

When presenting, interviewing, or pitch-decking online, speakers face several silent hurdles:
1. **The "Shifty Eyes" Tell:** Reading notes or script text off a second monitor makes your eyes dart left-to-right, instantly revealing to the audience/interviewer that you are reading.
2. **Brain Freeze under Pressure:** Forgetting critical architecture details or project examples when asked unexpected questions.
3. **Robotic AI Answers:** Traditional AI tools give generic, over-structured responses ("Certainly!", "Let's delve into...", "first, second, third...") that sound incredibly robotic and fail AI detectors.
4. **Screen-Share Paranoia:** Fear of accidentally sharing your script, prompt feeder, or chat window during a Zoom, Teams, or Google Meet screen share.
5. **Expensive Subscriptions:** Heavy monthly fees for specialized AI coaching or prompter tools.

---

## 🛠️ The Solution: How Ghost Coach Solves It

Ghost Coach acts as your invisible co-pilot:

* **Invisible to Screen Share (Anti-Leak):** It uses hardware-level window protection (`setContentProtection(true)`). Even if you share your entire screen on Zoom, Microsoft Teams, Discord, or Google Meet, the audience sees a completely blank screen where Ghost Coach is sitting, while you see your notes clearly.
* **Eye-Line Alignment (Teleprompter Mode):** The teleprompter scrolls your answers right at the top of your screen, just below your webcam. You can read your response while maintaining direct, natural eye contact with your camera.
* **Human-in-the-Loop AI responses:** The integrated LLM pipeline uses an **Identity-First Humanizer Persona** + **Few-Shot Examples** to strip out robotic AI tells. The output is direct, conversational, includes natural grammatical variations, and uses contractions—sounding like a highly senior human presenter.
* **Totally Free to Use:** Instead of a paid subscription, you bring your own free-tier API keys. By combining free tiers from Google Gemini, Groq (for voice transcription and chat), or OpenRouter, you can use the coach infinitely for $0.

---

## 🌟 Key Features

### 🎙️ Real-Time Voice Input & Transcription
* Toggle voice recording via the microphone icon or a global shortcut (`Cmd+Shift+L` / `Ctrl+Shift+L`).
* Automatically transcribes your voice query using high-speed **Groq Whisper Large v3** or **Gemini** APIs, placing it in the input area for review before sending.

### 🔄 Multi-Key API Rotation & Auto-Failover
* Add multiple API keys for each provider in a clean, dynamic Settings UI.
* The system automatically rotates to the next key when hit by rate limits (`429`), auth errors (`401`/`403`), or network drops.
* Intelligent retry loop handles transient upstream server errors without failing the request.

### 📜 Standalone Scrollable Teleprompter
* Decoupled into a draggable, resizable, horizontal banner window.
* Automatically scrolls incoming AI responses at a customizable reading speed.
* **Auto-Close:** Automatically hides itself as soon as the text finishes scrolling.
* **Keyboard Seeking:** Use `ArrowLeft` and `ArrowRight` to quickly nudge/scroll the text backward or forward.
* **Manual Controls:** Select any text in the chat feed and hit `Ctrl+D` to run it on the prompter, or `Ctrl+Shift+D` to append it.
* Close instantly at any time by pressing `Escape`.

### 🎨 Customizable Styling & Glassmorphism
* Modern glassmorphic dark mode styling.
* Real-time sliders in settings to change the background colors and opacity (transparency) of both the main app and the teleprompter window.

---

## 🚀 Getting Started

### 📋 Prerequisites
* **Node.js** (v18+)
* **npm**

### ⚙️ Installation

1. Clone the repository and navigate to the folder:
   ```bash
   git clone https://github.com/MuhammadDevPk/GhostCoach.git
   cd GhostCoach
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### 💻 Running in Development

Start both the Vite dev server and the Electron application concurrently:
```bash
npm run dev
```

### ⚙️ How to Configure Keys for Free Use
1. Click the **Gear ⚙️ icon** in the top-right corner of the overlay.
2. Under the **AI Provider** tab, choose your provider (e.g. Gemini, Groq, OpenRouter, or GitHub Models).
3. Get free API keys:
   * **Gemini Key:** Get one for free from Google AI Studio.
   * **Groq Key:** Get a free key from the Groq console (Whisper transcription is highly recommended here).
   * **OpenRouter Key:** Register at OpenRouter and get a key. You can use free models like `google/gemini-2.5-flash:free` or `meta-llama/llama-3-8b-instruct:free`.
4. Click **"+ Add API Key"** to paste multiple keys to prevent rate limits.
5. Under the **Candidate Profile** and **AI Guidelines** tabs, write your resume and customize how you want the AI to answer (e.g., "Give senior-level engineering answers with examples").
6. Click **Save & Apply**.

---

## 📦 Packaging

To build and package the application as a standalone macOS executable:
```bash
npm run build:mac
```
The packaged application executable will be created under the `dist/` directory (e.g., `dist/mac-arm64/windowserverhelper.app`).

---

## 🏗️ Technology Stack
* **Shell:** [Electron](https://www.electronjs.org/)
* **Frontend Framework:** [Vue 3](https://vuejs.org/) (SFC + Composition API)
* **Build Tool:** [Vite](https://vite.dev/)
* **WebSocket Client:** [Laravel Echo](https://github.com/laravel/echo) & [Pusher JS](https://github.com/pusher/pusher-js) (for remote guidance injection)
* **Testing:** [Vitest](https://vitest.dev/)
