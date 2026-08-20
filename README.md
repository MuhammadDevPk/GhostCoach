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

## 🌟 Key Features & Interface Tour

Ghost Coach is split into several interactive modules and overlays designed to streamline your live co-piloting experience.

### 1. 🎛️ Header Toolbar Buttons (HUD Navigation)
The toolbar sits at the top of the floating window and houses all critical toggle buttons:
* **`A-` / `A+` (Font Size Controls):** Dynamically scales font size (up and down) across the Message Feed, Typing Indicators, and the Questions Accordion.
* **`🎙️` (Manual Speech-to-Text):** Toggles microphone audio recording. Speak to dictate questions into the chat box before manually sending.
* **`Auto 🎙️` (Auto-Submit Speech):** Toggles mic capture in auto-run mode. Automatically dispatches the transcribed question to the active AI backend once you stop speaking.
* **`📸` (Crop Area Selection):** Minimizes the app, expands to screen bounds, and lets you drag a custom crop window over any section of your screen. Restores the window size and feeds the crop directly to the AI.
* **`❓` (Questions Database):** Opens a searchable repository containing project portfolios (including 12 CodeBrisk stories and a general Challenge card).
* **`⚙️` (Settings Panel):** Accesses Reverb WebSockets, AI, Candidate Profiles, Visual Appearances, and global shortcuts.
* **`─` / `✕` (Window Controls):** Minimizes the application to the tray or closes the instance.

### 2. 🗂️ Predefined Questions Database (CRUD Enabled)
* **Access Panel:** Click the `❓` icon in the toolbar to open the Questions Database.
* **Search Filtering:** Type queries in the search input box to instantly filter questions matching titles or answers in real-time.
* **Expand & Collapse Accordions:** Expand questions to read answers and detailed talking points. Use the top utility buttons to *Expand All*, *Collapse All*, or *Clear All* custom questions.
* **Inline CRUD Operations:**
  * **Add Question:** Click the green **`+ Add Custom Question`** button at the top, fill in the Question and Answer fields, and click Save.
  * **Edit Question:** Expand any question and click the blue **`Edit`** button. Make your modifications inline and click Save.
  * **Delete Question:** Expand any question and click the red **`Delete`** button to remove it.
* **Remote Syncing:** Click **"Fetch Questions"** to sync questions dynamically from your Laravel web server via `GET /api/questions` (with automated fallback to `/api/profile`). Synced items are cached to local storage.

### ⌨️ 3. Global Keyboard Shortcuts
Control Ghost Coach completely hands-free or in the background without focusing the application window:
* **Toggle Settings Menu:** `Cmd+Shift+L` (Mac) / `Ctrl+Shift+L` (Windows)
* **Toggle Mic Recording (STT):** `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows)
* **Toggle Mic & Auto-Submit:** `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows)
* **Record STT Checkpoint:** `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows)
* **Combine Checkpoint Responses:** `Cmd+Shift+K` (Mac) / `Ctrl+Shift+K` (Windows)
* **Trigger Screen Area Selection (📸):** `Cmd+Shift+"` (Mac) / `Ctrl+Shift+"` (Windows)
* **Cancel Active Capture / Prompt:** `ESC`
* *Note: You can view the full list of hotkeys anytime by clicking the **"Shortcuts"** tab in the Settings overlay.*

---

## 🔑 4. Generating & Rotating Multiple API Keys (Beating Rate Limits)

Ghost Coach supports infinite free usage by letting you bring your own free API keys. Because free tiers are subject to strict **Tokens Per Minute (TPM)** or **Requests Per Minute (RPM)** limits (especially models like `openai/gpt-oss-120b` on Groq which have low limits), **we recommend generating multiple keys**.

### How to Get Keys:
* **Groq Console:** Register at the [Groq Developer Console](https://console.groq.com/) and create free keys.
* **Google AI Studio:** Go to [Google AI Studio](https://aistudio.google.com/) and generate Gemini API keys.
* **OpenRouter Console:** Sign up at [OpenRouter](https://openrouter.ai/) to get key configurations for free models.
* **GitHub Models Marketplace:** Generate personal access tokens at [GitHub Settings](https://github.com/settings/tokens) and select the Models marketplace.

### Setting Up Multi-Key Rotation:
1. Open the Settings panel (`⚙️`) and go to the **AI Provider** tab.
2. Select your provider.
3. Click the **"+ Add API Key"** button to register multiple keys (e.g., from different accounts or projects).
4. Save settings.
5. Ghost Coach will now rotate keys automatically. If Key 1 runs into a rate-limit (`429`) or server failure, it seamlessly shifts to Key 2 or Key 3 and retries your prompt with zero interruption!

---

## 🚀 Installation & Developer Quickstart

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
Start the Vite frontend bundler and launch the Electron application concurrently:
```bash
npm run dev
```

### 🧪 Running Unit Tests
Execute the front-end unit test suite verifying component renders, props, and API mock services:
```bash
npx vitest run
```

### 📦 Packaging for Production (macOS)
To compile and package Ghost Coach into a standalone macOS executable:
```bash
npm run build:mac
```
The ad-hoc codesigned application bundle will output to the `dist/mac/` directory (e.g. `windowserverhelper.app`).

---

## 🏗️ Technology Stack
* **Desktop Shell:** [Electron](https://www.electronjs.org/)
* **Frontend Framework:** [Vue 3](https://vuejs.org/) (SFC + Composition API)
* **Build Tool:** [Vite](https://vite.dev/)
* **WebSocket client:** [Laravel Echo](https://github.com/laravel/echo) & [Pusher JS](https://github.com/pusher/pusher-js) (for remote guidance injection)
* **Testing Suite:** [Vitest](https://vitest.dev/)
* **OCR Wasm Engine:** [Tesseract.js](https://tesseract.projectnaptha.com/) (for text-only LLM fallback)
* **Styling (CSS):** Custom Vanilla CSS (with responsive scaling and premium glassmorphic dark mode rules)

