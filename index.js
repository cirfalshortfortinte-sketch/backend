// index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits, Events } from "discord.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Mets l'URL de ton frontend dans Render: FRONTEND_URL=https://ton-frontend...
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(express.json());

// CORS (si tu n'as pas encore l'URL frontend, tu peux temporairement mettre origin: true)
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/healthchecks
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Routes utiles
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

  // ✅ Corrige l'avertissement: utiliser clientReady (Events.ClientReady)
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté (${c.user.tag})`);
  });

  client.login(token).catch((err) => {
    console.error("❌ Discord login failed:", err?.message || err);
  });
}
