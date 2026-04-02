# ⚙️ Installation Guide — Satoshium Games

Satoshium Games modules are designed as **browser-native applications** that require no backend infrastructure.

Most environments can run immediately after download.

---

# 🌐 Running Modules Locally

To launch a module locally:

1. Clone the repository
2. Navigate to an application folder

Example:


apps/chess-signal/


3. Open:


index.html


inside a browser

No build system required for static deployments.

---

# 🧪 Development Mode (Optional)

If a module uses a development framework such as Vite:


npm install
npm run dev


This launches a local preview server.

---

# 🚀 Static Deployment

Modules are compatible with:

- GitHub Pages
- static hosting providers
- satoshium.xyz
- CDN-based hosting environments

Example deployment path:


satoshium.xyz/games/chess-signal/


---

# 🧩 Browser Compatibility

Recommended browsers:

- Chrome
- Edge
- Firefox
- Safari

Modern ES module support required.

---

# 🔐 Security Model

Simulation modules:

- do not require authentication
- do not transmit user data
- operate entirely client-side

Future modules may optionally integrate verification layers where appropriate.
