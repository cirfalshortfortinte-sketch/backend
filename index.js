// index.js (CommonJS)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL, // ex: https://ton-frontend.onrender.com
  "http://localhost:5173",
].filter(Boolean);

app.use(express.json());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Routes pour vérifier que le backend répond bien
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) =>
  res.status(200).json({ ok: true, uptime: process.uptime() })
);

app.listen(PORT, () => console.log(`🚀 Backend lancé sur le port ${PORT}`));

// ---- Discord bot ----
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.warn("⚠️ DISCORD_TOKEN manquant. Bot non démarré.");
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  // ✅ plus d'avertissement "ready" : utiliser ClientReady
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté (${c.user.tag})`);
  });

  client.login(token).catch((err) => {
    console.error("❌ Discord login failed:", err?.message || err);
  });
}
