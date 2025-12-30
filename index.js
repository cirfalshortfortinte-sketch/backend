// index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// URL de ton frontend (à définir sur Render)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,   // ex: https://mon-frontend.onrender.com
  "http://localhost:5173"
].filter(Boolean);

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true
  })
);

// Routes de test (OBLIGATOIRES)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime()
  });
});

// Démarrage HTTP
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});

// -------- Discord Bot --------
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.warn("⚠️ DISCORD_TOKEN manquant, bot non lancé");
} else {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  // ✅ plus de warning "ready"
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté : ${c.user.tag}`);
  });

  client.login(token).catch((err) => {
    console.error("❌ Erreur connexion Discord :", err);
  });
}
