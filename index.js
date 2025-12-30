// index.js
require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IMPORTANT: Origin = domaine seulement (pas /brainrot-order-form/)
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io", // ✅ GitHub Pages (origin réel)
  "http://localhost:5173",                        // dev
  (process.env.FRONTEND_URL || "").trim(),        // optionnel
].filter(Boolean);

// ---- CORS robuste + préflight ----
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

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "1mb" }));

// ---- Routes ----
app.get("/", (req, res) => res.status(200).send("OK"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// ---- Discord ----
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "").trim();

const client = DISCORD_TOKEN
  ? new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] })
  : null;

if (!DISCORD_TOKEN) {
  console.warn("⚠️ DISCORD_TOKEN manquant : bot non démarré");
} else {
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté : ${c.user.tag}`);
  });

  client.login(DISCORD_TOKEN).catch((err) => {
    console.error("❌ Discord login failed:", err?.message || err);
  });
}

// ✅ Route appelée par le frontend : /order
app.post("/order", async (req, res) => {
  try {
    const order = req.body;

    if (!order || typeof order !== "object") {
      return res.status(400).json({ ok: false, error: "Commande invalide" });
    }

    console.log("📦 Nouvelle commande reçue :", order);

    // Si le bot n'est pas prêt, on confirme quand même la réception
    if (!client) {
      return res.status(200).json({ ok: true, message: "Commande reçue (bot non configuré)" });
    }
    if (!CHANNEL_ID) {
      return res.status(200).json({ ok: true, message: "Commande reçue (CHANNEL_ID manquant)" });
    }

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return res.status(200).json({ ok: true, message: "Commande reçue (channel invalide)" });
    }

    const pretty = "```json\n" + JSON.stringify(order, null, 2) + "\n```";
    await channel.send({ content: `🛒 **Nouvelle commande reçue**\n${pretty}` });

    return res.status(200).json({ ok: true, message: "Commande envoyée ✅" });
  } catch (err) {
    console.error("❌ Erreur POST /order :", err);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// ---- Error middleware ----
app.use((err, req, res, next) => {
  console.error("❌ Error middleware:", err?.message || err);
  res.status(500).json({ ok: false, error: err?.message || "Server error" });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
  console.log(`✅ CORS autorisé pour: ${ALLOWED_ORIGINS.join(" | ")}`);
});
