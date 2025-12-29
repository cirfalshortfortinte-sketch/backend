require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const app = express();

// ⚡ Autoriser ton site GitHub Pages
app.use(cors({
  origin: 'https://cirfalshortfortinte-sketch.github.io/brainrot-order-form/' // <-- remplace par ton site si besoin
}));

app.use(express.json());

// BOT DISCORD
const bot = new Client({
  intents: [GatewayIntentBits.Guilds]
});

bot.login(process.env.DISCORD_TOKEN);

bot.once("ready", () => {
  console.log("🤖 Bot Discord connecté");
});

// ROUTE POUR LE SITE
app.post("/order", async (req, res) => {
  try {
    const {
      username,
      discord,
      items,
      payment,
      budget,
      urgency,
      message
    } = req.body;

    const channel = await bot.channels.fetch(process.env.CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle("🛒 Nouvelle commande")
      .setColor(0x9b59b6)
      .addFields(
        { name: "👤 Roblox", value: username, inline: true },
        { name: "💬 Discord", value: discord, inline: true },
        { name: "📦 Items", value: items.join("\n") || "Aucun" },
        { name: "💳 Paiement", value: payment, inline: true },
        { name: "💰 Budget", value: budget || "Non précisé", inline: true },
        { name: "⚡ Urgence", value: urgency, inline: true },
        { name: "📝 Message", value: message || "Aucun" }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ⚡ Défaut PORT si Render ne le fournit pas
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
