
import { SlashCommandBuilder } from 'discord.js'
import { isProgrammer } from '../functions/utility'
import { updateDeckTypes } from '../functions/chron'
import { emojis } from '../emojis/emojis'
import { client } from '../client'

export default {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Performs a test. 🧪'),
    async execute(interaction) {
        if (isProgrammer(interaction.member)) {
            updateDeckTypes(client)
            await interaction.reply(emojis.yellow)
        } else {
            await interaction.reply('🧪')
        }
    }
}