# Ghost Coach 👻 🎙️

Ghost Coach is a lightweight, frameless, and transparent Electron overlay designed to feed real-time coaching prompts, instructions, and teleprompter tips to presenters, interviewees, or speakers. It floats seamlessly on top of all windows and workspaces (including macOS full-screen apps) without grabbing focus, providing an unobtrusive way to receive live guidance.

---

## 🌟 Key Features

* **WebSocket Synchronization:** Seamless real-time updates via Laravel Reverb or Pusher WebSocket protocols.
* **Always-on-Top Transparent Overlay:** Zero-frame, glassmorphism-styled UI that floats over all displays, full-screen apps, and workspaces.
* **Skip Taskbar & Dock:** Runs quietly without cluttering the macOS Dock or system taskbar (`app.dock.hide()`).
* **Content Protection:** Automatically blocks screen-sharing and recording software from capturing the prompt overlay (`setContentProtection(true)`).
* **Dynamic Typography:** On-the-fly font size adjustment (A- / A+) for comfortable reading, saved to local storage.
* **Interactive Local Testing:** Simulator feature allows sending randomized dummy prompts to check rendering and readability without a live connection.
* **Custom Configuration Drawer:** Simple GUI to configure connection parameters like host, port, credentials, channel, and events.

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have **Node.js** (v18+ recommended) and **npm** installed on your system.

### ⚙️ Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd GhostCoach
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### 💻 Running in Development

Start both the Vite dev server and the Electron application concurrently:
```bash
npm run dev
```

---

## 🛠️ Configuration

By default, the client is configured to connect to:
* **Host:** `ws.helper-ext.larawork.com`
* **Port:** `443`
* **Protocol:** `https` (WSS / Secure WebSockets)
* **Channel:** `interview`
* **Event:** `.guidance.created`

You can change these settings at any time by clicking the **Gear ⚙️ icon** in the top-right corner of the overlay. All configuration values are cached locally inside the browser's `localStorage` and will persist across app restarts.

---

## 📦 Packaging

To build and package the application as a standalone macOS executable:
```bash
npm run build:mac
```
The packaged application package will be created under the `dist/` directory.

---

## 🏗️ Technology Stack

* **Shell:** [Electron](https://www.electronjs.org/)
* **Frontend Framework:** [Vue 3](https://vuejs.org/) (SFC + Composition API)
* **Build Tool:** [Vite](https://vite.dev/)
* **WebSocket Client:** [Laravel Echo](https://github.com/laravel/echo) & [Pusher JS](https://github.com/pusher/pusher-js)
