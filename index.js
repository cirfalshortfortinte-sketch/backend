// index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ Ajoute ici toutes les origines autorisées
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io", // ✅ ton frontend GitHub Pages
  "http://localhost:5173",                        // dev
  (process.env.FRONTEND_URL || "").trim(),        // optionnel (si tu l'utilises)
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // autorise les requêtes sans origin (curl / health checks)
      if (!origin) return cb(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      console.log("❌ CORS blocked:", origin);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Répond correctement aux preflights
app.options("*", cors());

// Routes
app.get("/", (req, res) => res.status(200).send("OK"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Démarrage HTTP
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
  console.log("✅ CORS autorisé pour:", ALLOWED_ORIGINS.join(" | "));
});

// -------- Discord Bot --------
const token = (process.env.DISCORD_TOKEN || "").trim();

if (!token) {
  console.warn("⚠️ DISCORD_TOKEN manquant, bot non lancé");
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté : ${c.user.tag}`);
  });

  client.login(token).catch((err) => {
    console.error("❌ Erreur connexion Discord :", err?.message || err);
  });
}
