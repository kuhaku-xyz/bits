import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import type { RedisClientType } from "redis";


export const setChannelsCommand = {
  data: new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set the voice and text channels for tracking")
    .addChannelOption((option) =>
      option
        .setName("voice")
        .setDescription("The voice channel to track")
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("text")
        .setDescription("The text channel for notifications")
        .setRequired(true),
    ),

  execute: async (
    interaction: ChatInputCommandInteraction,
    redis: RedisClientType,
  ) => {
    console.log("Executing setchannel command...");

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const voiceChannel = interaction.options.getChannel("voice", true);
    const textChannel = interaction.options.getChannel("text", true);

    if (voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "Please select a voice channel for the voice option.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (textChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "Please select a text channel for the text option.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await redis.set(`voiceChannel:${guildId}`, voiceChannel.id);
      await redis.set(`textChannel:${guildId}`, textChannel.id);

      await interaction.reply({
        content: `Set voice channel to ${voiceChannel.name} and text channel to ${textChannel.name}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error in setChannels command:", error);
      await interaction.reply({
        content: "An error occurred while setting the channels.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export const checkChannelsCommand = {
  data: new SlashCommandBuilder()
    .setName("checkchannels")
    .setDescription("Check the current voice and text channel settings"),
  async execute(
    interaction: ChatInputCommandInteraction,
    redis: RedisClientType,
  ) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const voiceChannelId = await redis.get(
      `voiceChannel:${interaction.guildId}`,
    );
    const textChannelId = await redis.get(`textChannel:${interaction.guildId}`);

    const voiceChannel = voiceChannelId
      ? await interaction.client.channels.fetch(voiceChannelId)
      : null;
    const textChannel = textChannelId
      ? await interaction.client.channels.fetch(textChannelId)
      : null;

    const response = [
      "Current channel settings:",
      `Voice Channel: ${voiceChannel?.type === ChannelType.GuildVoice ? voiceChannel.name : "Not set"}`,
      `Text Channel: ${textChannel?.type === ChannelType.GuildText ? textChannel.name : "Not set"}`,
    ].join("\n");

    await interaction.reply({
      content: response,
      flags: MessageFlags.Ephemeral,
    });
  },
};
