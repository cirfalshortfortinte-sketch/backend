// index.js
require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  Partials,
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IMPORTANT: Origin = domaine seulement (pas /brainrot-order-form/)
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io",
  "https://rot-market.com",
  "http://localhost:5173",
  (process.env.FRONTEND_URL || "").trim(),
].filter(Boolean);

// ---- CORS robuste + préflight ----
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
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
  ? new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages, // ✅ pour DM
      ],
      partials: [Partials.Channel], // ✅ pour DM
    })
  : null;

if (!DISCORD_TOKEN) {
  console.warn("⚠️ DISCORD_TOKEN manquant : bot non démarré");
} else {
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté : ${c.user.tag}`);

    // ✅ Statut du bot
    client.user.setPresence({
      activities: [
        {
          name: "vos commandes 📦",
          type: 3, // 3 = Watching
        },
      ],
      status: "online", // online | idle | dnd | invisible
    });
  });

  client.login(DISCORD_TOKEN).catch((err) => {
    console.error("❌ Discord login failed:", err?.message || err);
  });
}

// ---------- Helpers ----------
function safeStr(v, fallback = "—") {
  const s = (v ?? "").toString().trim();
  return s.length ? s : fallback;
}

function clamp(str, max = 1024) {
  if (!str) return str;
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// Accepte: "123456789012345678", "<@123...>", "<@!123...>"
function extractDiscordUserId(input) {
  const s = (input || "").trim();
  if (!s) return null;

  const mention = s.match(/^<@!?(\d{16,22})>$/);
  if (mention) return mention[1];

  const idOnly = s.match(/^(\d{16,22})$/);
  if (idOnly) return idOnly[1];

  // Si le champ contient quelque part un ID
  const anywhere = s.match(/(\d{16,22})/);
  if (anywhere) return anywhere[1];

  return null;
}

function urgencyLabel(u) {
  if (u === "urgent") return "🚀 Urgent";
  if (u === "fast") return "⚡ Rapide";
  return "⏱️ Normal";
}

function formatCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return "Aucun item";
  return cart
    .map((it) => {
      const icon = safeStr(it?.icon, "•");
      const name = safeStr(it?.name, "Item");
      const qty = Number(it?.quantity || 1);
      return `${icon} **${name}** × ${qty}`;
    })
    .join("\n");
}

function formatBrainrots(brainrots) {
  if (!Array.isArray(brainrots) || brainrots.length === 0) return "Aucun";
  return brainrots
    .map((b, i) => {
      const name = safeStr(b?.name, "Sans nom");
      const money = safeStr(b?.money, "—");
      const mut = safeStr(b?.mutations, "—");
      return `**#${i + 1} — ${name}**\n💰 ${money}\n🧬 ${clamp(mut, 300)}`;
    })
    .join("\n\n");
}

function buildOrderEmbed(order) {
  const orderNumber = safeStr(order?.orderNumber, "—");
  const username = safeStr(order?.username);
  const discord = safeStr(order?.discord);
  const email = safeStr(order?.email, "Non renseigné");
  const additionalInfo = safeStr(order?.additionalInfo, "Aucun message");
  const urgency = urgencyLabel(order?.urgency);

  const cartText = clamp(formatCart(order?.cart), 1024);
  const brainText = clamp(formatBrainrots(order?.brainrots), 1024);

  const embed = new EmbedBuilder()
    .setTitle("🛒 Nouvelle commande reçue")
    .setColor(0x8b5cf6) // violet
    .setTimestamp(new Date())
    .addFields(
      { name: "🔢 Numéro de commande", value: `#${orderNumber}`, inline: true },
      { name: "⏱️ Urgence", value: urgency, inline: true },
      { name: "👤 Roblox", value: username, inline: true },
      { name: "💬 Discord", value: discord, inline: true },
      { name: "📧 Email", value: email, inline: true },
      { name: "🧺 Panier", value: cartText },
      { name: "🧠 Brainrots", value: brainText },
      { name: "📝 Message", value: clamp(additionalInfo, 1024) }
    )
    .setFooter({ text: "RotMarket • Order System" });

  return embed;
}

function buildCustomerDMEmbed(order) {
  const orderNumber = safeStr(order?.orderNumber, "—");
  const urgency = urgencyLabel(order?.urgency);
  const cartText = clamp(formatCart(order?.cart), 1024);

  return new EmbedBuilder()
    .setTitle("✅ Ta commande a bien été envoyée !")
    .setColor(0x22c55e) // vert
    .setTimestamp(new Date())
    .setDescription(
      "Merci ! On va te contacter très vite sur Discord pour finaliser la commande."
    )
    .addFields(
      { name: "🔢 Numéro", value: `#${orderNumber}`, inline: true },
      { name: "⏱️ Urgence", value: urgency, inline: true },
      { name: "🧺 Récap panier", value: cartText }
    )
    .setFooter({ text: "RotMarket" });
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
      return res
        .status(200)
        .json({ ok: true, message: "Commande reçue (bot non configuré)" });
    }
    if (!CHANNEL_ID) {
      return res
        .status(200)
        .json({ ok: true, message: "Commande reçue (CHANNEL_ID manquant)" });
    }

    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return res
        .status(200)
        .json({ ok: true, message: "Commande reçue (channel invalide)" });
    }

    // ✅ Embed pour le staff (salon)
    const orderEmbed = buildOrderEmbed(order);

    // Petit bonus: mention si le client a mis une mention
    const maybePing = (order?.discord || "").trim().startsWith("<@")
      ? `${order.discord}\n`
      : "";

    await channel.send({
      content: `${maybePing}📦 **Commande enregistrée**`,
      embeds: [orderEmbed],
    });

    // ✅ DM client si ID trouvable
    const userId = extractDiscordUserId(order?.discord);
    let dmStatus = "skipped";

    if (userId) {
      try {
        const user = await client.users.fetch(userId);
        const dmEmbed = buildCustomerDMEmbed(order);
        await user.send({ embeds: [dmEmbed] });
        dmStatus = "sent";
      } catch (e) {
        // DM fermé / bot bloqué / user introuvable
        dmStatus = "failed";
        console.warn("⚠️ Impossible d'envoyer le DM:", e?.message || e);
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Commande envoyée ✅",
      dm: dmStatus,
      dmHint: userId
        ? undefined
        : "Aucun ID Discord détecté. Mets ton ID ou une mention <@id> pour recevoir le DM.",
    });
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
