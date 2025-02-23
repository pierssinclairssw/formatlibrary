
import { SlashCommandBuilder } from 'discord.js'
import { isProgrammer } from '@fl/bot-functions'
import { Deck, Player, Server, Tournament } from '@fl/models'
import { Op } from 'sequelize'
import { selectTournament } from '@fl/bot-functions'
import { checkExpiryDate, uploadDeckFolder } from '@fl/bot-functions'

export default {
    data: new SlashCommandBuilder()
        .setName('fix')
        .setDescription('Fix an issue. 🛠️'),
    async execute(interaction) {
        await interaction.deferReply()
        if (isProgrammer(interaction.member)) {
            const tournaments = await Tournament.findAll({
                where: {
                    serverId: interaction.guildId,
                    createdAt: { [Op.gte]: "2022-12-01 00:00:00.000+00" },
                },
                order: [["createdAt", "ASC"]],
            })

            const tournament = await selectTournament(interaction, tournaments)
            if (!tournament) return

            const server = await Server.findOne({ where: {
                id: interaction.guildId
            }})

            const decks = await Deck.findAll({
                where: {
                    eventName: {
                        [Op.or]: [tournament.abbreviation, tournament.name]
                    }
                },
                include: Player
            })

            try {
                await checkExpiryDate(server)
                await uploadDeckFolder(server, tournament.name, decks)
                return await interaction.editReply({ content: `Your tournament files have been uploaded! ${server.logo}` })
            } catch (err) {
                console.log(err)
                return await interaction.editReply({ content: `Error. Check bot logs.` })
            }
        } else {
            return await interaction.editReply('🛠️')
        }
    }
}