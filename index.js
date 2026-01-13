// index.js
require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  Partials,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS
   ========================= */

// ⚠️ Mets ici les domaines de ton front (sans /index.html)
const ALLOWED_ORIGINS = [
  "https://cirfalshortfortinte-sketch.github.io",
  "https://rot-market.com",
  "http://localhost:5173",
  (process.env.FRONTEND_URL || "").trim(),
].filter(Boolean);

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

/* =========================
   ROUTES DE TEST
   ========================= */

app.get("/", (req, res) => res.status(200).send("OK"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

/* =========================
   DISCORD CONFIG
   ========================= */

const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();

// Salon où les commandes sont loggées (le même que tu utilises déjà)
const ORDER_CHANNEL_ID = (
  process.env.ORDER_CHANNEL_ID ||
  process.env.CHANNEL_ID ||
  ""
).trim();

// Tickets
const TICKET_CATEGORY_ID = (process.env.TICKET_CATEGORY_ID || "").trim();
const STAFF_ROLE_ID = (process.env.STAFF_ROLE_ID || "").trim();
const TICKET_LOG_CHANNEL_ID = (process.env.TICKET_LOG_CHANNEL_ID || "").trim();
const TICKET_PANEL_CHANNEL_ID = (process.env.TICKET_PANEL_CHANNEL_ID || "").trim();
const TICKET_PREFIX = (process.env.TICKET_PREFIX || "!ticket").trim();

const TICKET_PANEL_FOOTER = "ticket-panel-v1";
let ticketPanelMessageId = null;

/* =========================
   DISCORD CLIENT
   ========================= */

const client = DISCORD_TOKEN
  ? new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    })
  : null;

if (!DISCORD_TOKEN) {
  console.warn("⚠️ DISCORD_TOKEN manquant : bot non démarré");
} else {
  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot Discord connecté : ${c.user.tag}`);
    logTicketConfigWarnings();
    ensureTicketPanel();
  });

  client
    .login(DISCORD_TOKEN)
    .catch((err) => console.error("❌ Discord login failed:", err?.message || err));
}

/* =========================
   HELPERS GÉNÉRAUX
   ========================= */

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

/* =========================
   EMBEDS COMMANDE
   ========================= */

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

/* =========================
   ROUTE /order (FRONTEND)
   ========================= */

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
    if (!ORDER_CHANNEL_ID) {
      return res
        .status(200)
        .json({ ok: true, message: "Commande reçue (ORDER_CHANNEL_ID manquant)" });
    }

    const channel = await client.channels.fetch(ORDER_CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return res
        .status(200)
        .json({ ok: true, message: "Commande reçue (channel invalide)" });
    }

    const orderEmbed = buildOrderEmbed(order);

    const maybePing =
      (order?.discord || "").trim().startsWith("<@") ? `${order.discord}\n` : "";

    await channel.send({
      content: `${maybePing}📦 **Commande enregistrée**`,
      embeds: [orderEmbed],
    });

    const userId = extractDiscordUserId(order?.discord);
    let dmStatus = "skipped";

    if (userId) {
      try {
        const user = await client.users.fetch(userId);
        const dmEmbed = buildCustomerDMEmbed(order);
        await user.send({ embeds: [dmEmbed] });
        dmStatus = "sent";
      } catch (e) {
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

/* =========================
   TICKETS
   ========================= */

function logTicketConfigWarnings() {
  if (!TICKET_PANEL_CHANNEL_ID) {
    console.warn("⚠️ TICKET_PANEL_CHANNEL_ID manquant : panel désactivé");
  }
  if (!ORDER_CHANNEL_ID) {
    console.warn("⚠️ ORDER_CHANNEL_ID manquant : vérification commande impossible pour tickets");
  }
  if (!TICKET_LOG_CHANNEL_ID) {
    console.warn("⚠️ TICKET_LOG_CHANNEL_ID manquant : log tickets désactivé");
  }
}

function extractOrderNumber(text) {
  return (text || "").toString().replace(/[^0-9]/g, "");
}

async function safeReply(message, payload) {
  if (!message?.reply) return false;
  try {
    await message.reply(payload);
    return true;
  } catch (err) {
    console.warn("Reply failed:", err?.message || err);
    return false;
  }
}

async function promptForOrderNumber(message) {
  if (!message?.channel?.isTextBased()) return null;

  await safeReply(message, "Quel est ton numéro de commande ?");

  try {
    const filter = (msg) => msg.author?.id === message.author.id && msg.content;
    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60_000,
    });

    const reply = collected?.first();
    if (!reply) {
      await safeReply(message, "Temps écoulé. Relance la commande.");
      return null;
    }

    const orderNumber = extractOrderNumber(reply.content);
    if (!orderNumber) {
      await safeReply(message, "Numéro invalide. Relance la commande.");
      return null;
    }

    return orderNumber;
  } catch (err) {
    console.warn("Order prompt failed:", err?.message || err);
    await safeReply(message, "Erreur pendant la demande de numéro.");
    return null;
  }
}

function buildTicketEmbed({ orderNumber, description, requesterTag, requesterId }) {
  return new EmbedBuilder()
    .setTitle("Ticket commande")
    .setColor(0x3b82f6)
    .setTimestamp(new Date())
    .addFields(
      { name: "Order number", value: `#${orderNumber}`, inline: true },
      { name: "User", value: `<@${requesterId}> (${requesterTag})`, inline: true },
      {
        name: "Description",
        value: clamp(safeStr(description, "No description"), 1024),
      }
    );
}

function buildTicketConfirmationEmbed({ orderNumber, channelId }) {
  return new EmbedBuilder()
    .setTitle("Ticket créé")
    .setColor(0x22c55e)
    .setTimestamp(new Date())
    .addFields(
      { name: "Order number", value: `#${orderNumber}`, inline: true },
      { name: "Channel", value: `<#${channelId}>`, inline: true }
    );
}

function buildTicketPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("Ouvrir un ticket")
    .setColor(0x8b5cf6)
    .setDescription(
      "Pour ouvrir un ticket, utilise la commande ci-dessous puis donne ton numéro de commande."
    )
    .addFields(
      {
        name: "Commande",
        value: `\`${TICKET_PREFIX}\``,
      },
      {
        name: "Exemple",
        value: `\`${TICKET_PREFIX}\` puis réponds: \`123456\``,
      }
    )
    .setFooter({ text: TICKET_PANEL_FOOTER });
}

function isTicketPanelMessage(message) {
  const embed = message?.embeds?.[0];
  if (!embed) return false;
  const footer = embed.footer?.text || "";
  return footer === TICKET_PANEL_FOOTER;
}

async function ensureTicketPanel() {
  if (!client || !TICKET_PANEL_CHANNEL_ID) return;

  try {
    const channel = await client.channels
      .fetch(TICKET_PANEL_CHANNEL_ID)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    let panelMessage = null;

    if (ticketPanelMessageId) {
      panelMessage = await channel.messages
        .fetch(ticketPanelMessageId)
        .catch(() => null);
    }

    if (!panelMessage) {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (messages) {
        panelMessage = messages.find(
          (msg) => msg.author?.id === client.user?.id && isTicketPanelMessage(msg)
        );
      }
    }

    if (!panelMessage) {
      panelMessage = await channel.send({ embeds: [buildTicketPanelEmbed()] });
    } else {
      await panelMessage.edit({ content: "", embeds: [buildTicketPanelEmbed()] });
    }

    if (panelMessage) {
      ticketPanelMessageId = panelMessage.id;
    }
  } catch (err) {
    console.error("Ticket panel update failed:", err?.message || err);
  }
}

function parseTicketCommand(content) {
  if (!content || !TICKET_PREFIX) return null;

  const trimmed = content.trim();
  if (!trimmed.toLowerCase().startsWith(TICKET_PREFIX.toLowerCase())) return null;

  const rest = trimmed.slice(TICKET_PREFIX.length).trim();
  const usage = `Utilisation: ${TICKET_PREFIX} <numéro>`;

  if (!rest) return { orderNumber: "", description: "" };

  const [orderToken, ...descParts] = rest.split(/\s+/);
  const orderNumber = extractOrderNumber(orderToken);
  if (!orderNumber) return { error: usage };

  const description = descParts.join(" ").trim();
  return { orderNumber, description };
}

function buildTicketChannelName(orderNumber) {
  return `ticket-${orderNumber}`;
}

function embedHasOrderNumber(embed, orderNumber) {
  const needle = `#${orderNumber}`;
  if (embed?.title && embed.title.includes(needle)) return true;
  if (embed?.description && embed.description.includes(needle)) return true;
  if (Array.isArray(embed?.fields)) {
    return embed.fields.some(
      (field) =>
        (field?.value && field.value.includes(needle)) ||
        (field?.name && field.name.includes(needle))
    );
  }
  return false;
}

async function fetchOrderEmbedFromLog(orderNumber) {
  if (!client || !ORDER_CHANNEL_ID) return null;

  const channel = await client.channels.fetch(ORDER_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return null;

  for (const msg of messages.values()) {
    if (!msg?.embeds?.length) continue;
    const match = msg.embeds.find((embed) => embedHasOrderNumber(embed, orderNumber));
    if (match) return match;
  }

  return null;
}

/* =========================
   ÉVÉNEMENTS DISCORD (TICKETS)
   ========================= */

if (client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message?.content || message.author?.bot) return;

      const parsed = parseTicketCommand(message.content);
      if (!parsed) return;

      if (!message.guild) {
        await safeReply(
          message,
          "Les tickets doivent être ouverts sur le serveur (pas en DM)."
        );
        return;
      }

      if (parsed.error) {
        await safeReply(message, parsed.error);
        return;
      }

      let { orderNumber, description } = parsed;

      if (!ORDER_CHANNEL_ID) {
        await safeReply(
          message,
          "ORDER_CHANNEL_ID manquant. Impossible de vérifier la commande."
        );
        return;
      }

      if (!orderNumber) {
        orderNumber = await promptForOrderNumber(message);
        if (!orderNumber) return;
      }

      const orderEmbed = await fetchOrderEmbedFromLog(orderNumber);
      if (!orderEmbed) {
        await safeReply(
          message,
          `Commande introuvable pour le numéro #${orderNumber}. Vérifie que la commande existe bien.`
        );
        return;
      }

      if (!description) {
        description = "Voir commande jointe.";
      }

      const channelName = buildTicketChannelName(orderNumber);

      const existing = message.guild.channels.cache.find(
        (ch) => ch.name === channelName
      );
      if (existing) {
        await safeReply(message, `Ticket déjà ouvert: <#${existing.id}>`);
        return;
      }

      const parent =
        TICKET_CATEGORY_ID && message.guild.channels.cache.get(TICKET_CATEGORY_ID);
      const parentId =
        parent && parent.type === ChannelType.GuildCategory ? parent.id : undefined;

      const overwrites = [
        {
          id: message.guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: message.author.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ];

      if (STAFF_ROLE_ID) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }

      const topicBase = `Order #${orderNumber} | user ${message.author.tag} (${message.author.id})`;
      const topic =
        topicBase.length > 1024 ? `${topicBase.slice(0, 1021)}...` : topicBase;

      const ticketChannel = await message.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentId,
        topic,
        permissionOverwrites: overwrites,
      });

      const ticketEmbed = buildTicketEmbed({
        orderNumber,
        description,
        requesterTag: message.author.tag,
        requesterId: message.author.id,
      });

      await ticketChannel.send({
        content: `<@${message.author.id}> Ticket créé. Le staff arrive.`,
        embeds: [ticketEmbed],
      });

      await ticketChannel.send({ embeds: [orderEmbed] });

      if (TICKET_LOG_CHANNEL_ID) {
        const logChannel = await client.channels
          .fetch(TICKET_LOG_CHANNEL_ID)
          .catch(() => null);

        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [ticketEmbed] });
        }
      }

      const confirmationEmbed = buildTicketConfirmationEmbed({
        orderNumber,
        channelId: ticketChannel.id,
      });
      await safeReply(message, { embeds: [confirmationEmbed] });
    } catch (err) {
      console.error("Ticket creation failed:", err?.message || err);
      if (message?.channel?.isTextBased()) {
        safeReply(message, "Erreur: impossible de créer le ticket.");
      }
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!TICKET_PANEL_CHANNEL_ID || !ticketPanelMessageId) return;

    const msg = newMessage?.partial
      ? await newMessage.fetch().catch(() => null)
      : newMessage;
    if (!msg) return;

    if (msg.id !== ticketPanelMessageId) return;
    await msg
      .edit({ content: "", embeds: [buildTicketPanelEmbed()] })
      .catch(() => null);
  });

  client.on(Events.MessageDelete, async (message) => {
    if (!TICKET_PANEL_CHANNEL_ID) return;

    const channelId = message?.channel?.id || message?.channelId;
    if (channelId !== TICKET_PANEL_CHANNEL_ID) return;

    if (!ticketPanelMessageId || message.id !== ticketPanelMessageId) {
      if (!ticketPanelMessageId) await ensureTicketPanel();
      return;
    }

    ticketPanelMessageId = null;
    await ensureTicketPanel();
  });
}

/* =========================
   ERROR MIDDLEWARE EXPRESS
   ========================= */

app.use((err, req, res, next) => {
  console.error("❌ Error middleware:", err?.message || err);
  res.status(500).json({ ok: false, error: err?.message || "Server error" });
});

/* =========================
   START SERVER
   ========================= */

app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
  console.log(`✅ CORS autorisé pour: ${ALLOWED_ORIGINS.join(" | ")}`);
});
