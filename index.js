// index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits, Events } from "discord.js";

const app = express();

// --- CONFIG ---
const PORT = process.env.PORT || 3000;

// Mets l'URL de ton frontend ici (IMPORTANT). Exemple Render/Vercel/Netlify.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,      // ex: https://mon-frontend.onrender.com
  "http://localhost:5173",       // dev Vite
  "http://localhost:3000",       // au cas où
].filter(Boolean);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) => {
      // Autorise les requêtes sans origin (ex: curl, health checks)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// --- ROUTES (IMPORTANT pour éviter "backend indisponible") ---
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Exemple d'endpoint (optionnel)
app.post("/api/ping", (req, res) => {
  res.json({ pong: true, body: req.body ?? null });
});

// --- START HTTP SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});

// --- DISCORD BOT ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.warn("⚠️ DISCORD_TOKEN manquant. Le bot Discord ne sera pas démarré.");
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  // Discord.js v14+ : utiliser Events.ClientReady
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté en tant que ${c.user.tag}`);
  });

  client.login(DISCORD_TOKEN).catch((err) => {
    console.error("❌ Connexion Discord échouée :", err?.message || err);
  });
}
