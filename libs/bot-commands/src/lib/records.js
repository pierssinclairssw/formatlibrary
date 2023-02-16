
import { SlashCommandBuilder } from 'discord.js'
import { Format, Match, Player, Server } from '@fl/models'
import { hasAffiliateAccess } from '@fl/bot-functions'
import { Op } from 'sequelize'
import { emojis } from '@fl/bot-emojis'

export default {
    data: new SlashCommandBuilder()
        .setName('records')
        .setDescription(`View a player's match records. 📘`)
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('The player you want to check.')
                .setRequired(false)
        ),
    async execute(interaction) {
        const server = !interaction.guildId ? {} : 
            await Server.findOne({ where: { id: interaction.guildId }}) || 
            await Server.create({ id: interaction.guildId, name: interaction.guild.name })
        
        if (!hasAffiliateAccess(server)) return await interaction.reply({ content: `This feature is only available with affiliate access. ${emojis.legend}`})
        
        const format = await Format.findOne({
            where: {
                [Op.or]: {
                    name: {[Op.iLike]: server.format },
                    channel: interaction.channelId
                }
            }
        })

        if (!format) return await interaction.reply({ content: `Try using **/history** in channels like: <#414575168174948372> or <#629464112749084673>.`})  

        let x = 50
        if (x > 250) return await interaction.reply({ content: "Please provide a number less than or equal to 250."})
        
        const user = interaction.options.getUser('player') || interaction.user    
        const discordId = user.id
        const player = await Player.findOne({ where: { discordId: discordId } })
        if (!player) return await interaction.reply({ content: "That user is not in the database."})
        const serverId = server.internalLadder ? server.id : '414551319031054346'

        const matches = await Match.findAll({
            where: {
                format: format.name,
                [Op.or]: [
                    { winnerId: player.id }, 
                    { loserId: player.id }
                ],
                serverId: serverId
            },
            limit: 250,
            order: [['createdAt', 'DESC']]
        })

        const records = [`__**${player.name}'s Last ${matches.length} ${format.name} Format ${format.emoji} Matches**__`]

        const now = Date.now()

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i]
            const outcome = match.winnerId === player.id ? 'Win' : 'Loss'
            const opponent = match.winnerId === player.id ? match.loser : match.winner
            const emoji = match.winnerId === player.id ? emojis.legend : emojis.mad
            const difference = now - match.createdAt
            const timeAgo = difference < 1000 * 60 * 60 ?  `${Math.round(difference / (1000 * 60))}m ago` :
                difference >= 1000 * 60 * 60 && difference < 1000 * 60 * 60 * 24 ? `${Math.round(difference / (1000 * 60 * 60))}h ago` :
                difference >= 1000 * 60 * 60 * 24 && difference < 1000 * 60 * 60 * 24 * 30 ? `${Math.round(difference / (1000 * 60 * 60 * 24))}d ago` :
                difference >= 1000 * 60 * 60 * 24 * 30 && difference < 1000 * 60 * 60 * 24 * 365 ? `${Math.round(difference / (1000 * 60 * 60 * 24 * 30))}mo ago` :
                `${Math.round(difference / (1000 * 60 * 60 * 24 * 365))}y ago`

            const record = `${outcome} ${emoji} vs ${opponent} - ${timeAgo}, ${match.createdAt.toLocaleString()}`
            records.push(record)
        }

        for (let i = 0; i < records.length; i+=10) {
            interaction.member.send(records.slice(i, i+10).join('\n'))
        }

        return await interaction.reply(`Please check your DMs.`)
    }
}
