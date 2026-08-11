# Ghost Coach 👻 🎙️
### *The Ultimate Real-Time AI Interview, Meeting & Presentation Co-Pilot*

Ghost Coach is a highly competitive, market-disrupting, and lightweight desktop application designed to act as your invisible live co-pilot. It floats seamlessly on top of all windows and workspaces (including macOS full-screen apps) without grabbing focus, feeding you real-time guidance, AI-assisted coaching prompts, and a scrolling eye-line teleprompter during high-stakes moments.

Unlike passive "tutors" that only help you prepare beforehand, **Ghost Coach is an active, real-time assistant** that sits with you live in the hot seat—completely invisible to remote participants.

---

## 🚀 Why Ghost Coach? The Market Need

In a world of remote work, online education, and video-first business, the stakes for live speaking are higher than ever. Presenters, interviewees, and students face critical hurdles:

1. **The "Shifty Eyes" Tell:** Reading notes from a second monitor makes your eyes dart away, instantly revealing to your audience or interviewer that you are reading.
2. **Unexpected Brain Freeze:** Forgetting critical metrics, technical architectures, or specific examples under pressure.
3. **Robotic AI Fingerprints:** Standard AI tools write answers filled with telling clichés (*"Certainly!", "Let's delve into...", "streamline", "multifaceted"*) that sound unnatural and easily fail human scrutiny.
4. **Screen-Share Exposure:** The constant fear of accidentally showing your cheat sheet or prompting window during a Zoom, Teams, or Google Meet screen share.

**Ghost Coach is the first application built from the ground up to solve all of these challenges at once, for free.**

---

## 🛠️ Disruptive Solutions & Competitive Edge

* **Invisible to Screen Share (Hardware-Level Protection):** Ghost Coach leverages OS-level window protection (`setContentProtection(true)`). Even if you share your entire desktop screen on Zoom, Microsoft Teams, Google Meet, Discord, or Webex, remote viewers see absolutely nothing where Ghost Coach sits. It remains 100% visible to you.
* **Camera Eye-Line Alignment:** A standalone, horizontal scrolling teleprompter sits directly below your webcam lens. You can read your custom prompts and answers while maintaining direct, natural eye contact with your camera.
* **Identity-First Persona + Few-Shot Humanizer:** Built-in AI prompts intercept responses, rewriting them to sound conversational, human, and authentic. It injects natural sentence variation, contractions, and cuts out statistical AI tells.
* **Zero Subscription Cost:** Instead of high monthly subscription fees, you bring your own free-tier API keys (Gemini, Groq, OpenRouter, GitHub Models). Use the platform infinitely for $0.

---

## 💡 Key Use Cases & Applications

Ghost Coach is designed to support users across multiple high-pressure environments:

### 1. 💼 Live Corporate Meetings & Technical Discussions
* **Unexpected Questions:** If a stakeholder asks for details on a system you haven't reviewed recently, trigger the shortcut, capture the question, and receive structured talking points instantly.
* **Reference Metrics on the Fly:** Get quick assistance on product metrics, deployment statuses, or cloud architecture terms when you forget them unexpectedly.

### 2. 🎓 Education, Students & Academic Vivas
* **Interview Prep & Practice:** Simulate live interview scenarios. Speak your answers, see how the AI refines them to sound more senior, and practice reading them back.
* **Viva Voce & Oral Exams:** Practice explaining complex academic topics concisely under pressure with a live prompt assistant.

### 3. 🎤 Keynote Presentations & Pitch Decks
* **Polished Responses:** When client Q&A demands quick, polished, and professional answers rather than generic AI responses, use the assistant to craft context-aware speaking points on the fly.
* **Teleprompter Drills:** Read your slides' key notes right in your webcam's eye-line without having to print paper notes or look down.

---

## 🌟 Key Features

### 🎙️ Segmented Audio Checkpointing (First in Market)
* **Keep Listening during AI Calls (`Cmd+Shift+P` / `Ctrl+Shift+P`):** In long meetings or multi-part questions, send a partial checkpoint of your recorded audio to get a head start on the AI's response while the microphone continues recording the rest of the conversation.
* **Local Response Merging (`Cmd+Shift+K` / `Ctrl+Shift+K`):** Instantly concatenate your checkpoint response and your final response into a single, cohesive reading format locally—instantly and with **zero extra API token costs or rate limits**.

### 🔄 Multi-Key API Rotation & Auto-Failover
* **Key Rotation:** Register multiple API keys for Google Gemini, Groq, OpenRouter, or GitHub Models.
* **Auto-Failover:** The application automatically rotates to the next key if a key hits rate limits (429), auth failures (401/403), or upstream service drops.
* **Intelligent Retry:** Transient upstream failures are caught and retried automatically behind the scenes.

### 📜 Standalone Scrollable Teleprompter Banner
* Decoupled into a draggable, resizable, horizontal overlay.
* **Keyboard Navigation:** Use `ArrowLeft` / `ArrowRight` to quickly scroll/seek text forward or backward.
* **Auto-Close:** Automatically hides itself from view the moment the text finished scrolling to keep your workspace clean.
* **Hot-Key Injection:** Select any text inside the chat view and press `Ctrl+D` to push it to the prompter, or `Ctrl+Shift+D` to append it.

### 🎨 Seamless UX & Glassmorphism Styling
* **Dynamic Input Auto-Resize:** The chat input bar automatically grows and shrinks vertically as you type long prompts, avoiding frustrating inner scrollbars and UI stutter.
* **Glassmorphic Styling:** Sleek, modern dark mode design. Change background transparency and layout padding in real-time from the settings menu.

---

## 🚀 Getting Started

### 📋 Prerequisites
* **Node.js** (v18+)
* **npm**

### ⚙️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MuhammadDevPk/GhostCoach.git
   cd GhostCoach
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### 💻 Running in Development

Start the Vite development server and launch the Electron container concurrently:
```bash
npm run dev
```

### ⚙️ How to Configure Keys for Free Use
1. Click the **Gear ⚙️ icon** in the top-right corner of the window.
2. Select the **AI Provider** tab and choose your preferred backend (e.g., Gemini, Groq, OpenRouter, or GitHub Models).
3. Paste your API keys:
   * **Gemini Key:** Get a free key from Google AI Studio.
   * **Groq Key:** Get a free key from the Groq Console (Whisper transcription is highly recommended here).
   * **OpenRouter Key:** Register at OpenRouter and use free models like `google/gemini-2.5-flash:free` or `meta-llama/llama-3-8b-instruct:free`.
4. Click **"+ Add API Key"** to list multiple keys to enable auto-rotation.
5. In **Candidate Profile** and **AI Guidelines**, add your resume and specific style instructions.
6. Click **Save & Apply**.

---

## 📦 Packaging

To compile and package Ghost Coach into a standalone macOS executable:
```bash
npm run build:mac
```
The packaged application binary will be outputted to the `dist/` directory (e.g., `dist/mac-arm64/windowserverhelper.app`).

---

## 🏗️ Technology Stack
* **Desktop Shell:** [Electron](https://www.electronjs.org/)
* **Frontend Framework:** [Vue 3](https://vuejs.org/) (SFC + Composition API)
* **Build Tool:** [Vite](https://vite.dev/)
* **WebSocket Injection:** [Laravel Echo](https://github.com/laravel/echo) & [Pusher JS](https://github.com/pusher/pusher-js) (for remote guidance injection)
* **Testing Suite:** [Vitest](https://vitest.dev/)
