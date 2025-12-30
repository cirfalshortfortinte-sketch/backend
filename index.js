// index.js
require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- CORS (robuste) --------------------
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io/brainrot-order-form/", // ✅ ton GitHub Pages
  "http://localhost:5173",                        // dev
  (process.env.FRONTEND_URL || "").trim(),        // optionnel
].filter(Boolean);

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

  // ✅ Répond aux preflights
  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

app.use(express.json({ limit: "1mb" }));

// -------------------- Routes utilitaires --------------------
app.get("/", (req, res) => res.status(200).send("OK"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// -------------------- Discord Bot --------------------
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "").trim();

const client =
  DISCORD_TOKEN
    ? new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      })
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

// -------------------- ROUTE PRINCIPALE: /order --------------------
// ✅ Ton frontend envoie la commande vers /order, donc on la gère ici
app.post("/order", async (req, res) => {
  try {
    const order = req.body;

    if (!order || typeof order !== "object") {
      return res.status(400).json({ ok: false, error: "Commande invalide" });
    }

    console.log("📦 Nouvelle commande reçue :", order);

    // Envoi dans Discord si possible
    if (!client) {
      return res.status(200).json({
        ok: true,
        message: "Commande reçue (bot Discord non configuré)",
      });
    }

    if (!CHANNEL_ID) {
      return res.status(200).json({
        ok: true,
        message: "Commande reçue (CHANNEL_ID manquant)",
      });
    }

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return res.status(200).json({
        ok: true,
        message: "Commande reçue (channel introuvable ou non textuel)",
      });
    }

    // Texte lisible même si la structure de l'objet order varie
    const pretty = "```json\n" + JSON.stringify(order, null, 2) + "\n```";

    await channel.send({
      content: `🛒 **Nouvelle commande reçue**\n${pretty}`,
    });

    return res.status(200).json({ ok: true, message: "Commande envoyée ✅" });
  } catch (err) {
    console.error("❌ Erreur POST /order :", err);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// -------------------- Gestion d'erreurs --------------------
app.use((err, req, res, next) => {
  console.error("❌ Error middleware:", err?.message || err);
  res.status(500).json({ ok: false, error: err?.message || "Server error" });
});

// -------------------- Start server --------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
  console.log(`✅ CORS autorisé pour: ${ALLOWED_ORIGINS.join(" | ")}`);
});

