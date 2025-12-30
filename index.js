// index.js - version "CORS GitHub Pages" robuste
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Origines autorisées
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io",
  "http://localhost:5173",
].concat((process.env.FRONTEND_URL || "").trim() ? [(process.env.FRONTEND_URL || "").trim()] : []);

// ✅ Middleware CORS "sûr" + préflight
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
  }

  // ✅ Répond toujours aux preflights
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

// Routes de test
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) =>
  res.status(200).json({ ok: true, uptime: process.uptime() })
);

// ⚠️ Exemple route de commande (à adapter à ton frontend)
app.post("/command", async (req, res) => {
  // Ici tu reçois la commande envoyée par le frontend
  // Exemple: { command: "..." }
  res.status(200).json({ ok: true, received: req.body ?? null });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
  console.log(`✅ CORS autorisé pour: ${ALLOWED_ORIGINS.join(" | ")}`);
});

// Discord
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
