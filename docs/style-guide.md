# 🎨 Style Guide — Satoshium Games

This document defines interface and architectural conventions used across Satoshium Games modules.

Consistency ensures that simulations remain recognizable as part of the Satoshium platform ecosystem.

---

# 🧩 Interface Philosophy

Game environments should feel:

- structured
- calm
- inspectable
- educational
- signal-aware
- trustworthy

Visual noise and opaque UI metaphors should be minimized.

---

# 🌐 Browser-First Design

Modules should:

- run without servers
- avoid external dependencies where possible
- support static deployment
- remain portable across hosting environments

Client-side execution is preferred whenever feasible.

---

# 📡 Signal Visibility

Where signals exist, interfaces should:

- label them clearly
- expose their meaning
- avoid hidden weighting systems
- avoid unexplained scores

Transparency is a primary design goal.

---

# ♟️ Explainable Interaction

Simulation feedback should answer:

- what changed
- why it changed
- what signals influenced outcomes
- how users can respond

This distinguishes Satoshium Games from traditional game engines.

---

# 🎮 Module Structure Convention

Each application should follow:


apps/module-name/


Example:


apps/chess-signal/


Modules should remain self-contained and deployable independently.

---

# 🌍 Platform Consistency

Modules should visually and structurally align with:

- satoshium.ai
- satoshium.net
- satoshium.xyz
- satoshium.dev

This preserves ecosystem cohesion.
