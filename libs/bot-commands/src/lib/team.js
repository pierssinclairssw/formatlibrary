
import { SlashCommandBuilder } from 'discord.js'
import { Entry, Format, Player, Server, Team, Tournament } from '@fl/models'
import { emojis } from '@fl/bot-emojis'
import { hasPartnerAccess, postParticipant, shuffleArray } from '@fl/bot-functions'
import { Op } from 'sequelize'

export default {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Register a team. 🏀')
        .addStringOption(str =>
            str
                .setName('name')
                .setDescription('Enter team name.')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('teammate1')
                .setDescription('Your first teammate.')
                .setRequired(true))
        .addUserOption(option =>
            option
                .setName('teammate2')
                .setDescription('Your other teammate.')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply()
        const teamName = interaction.options.getString('name')  
        const captain = await Player.findOne({ where: { discordId: interaction.user.id }})
        const teammate1 = await Player.findOne({ where: { discordId: interaction.options.getUser('teammate1').id }})
        const teammate2 = await Player.findOne({ where: { discordId: interaction.options.getUser('teammate2').id }})

        const server = !interaction.guildId ? {} : 
            await Server.findOne({ where: { id: interaction.guildId }}) || 
            await Server.create({ id: interaction.guildId, name: interaction.guild.name })
        
        if (!hasPartnerAccess(server)) return await interaction.reply({ content: `This feature is only available with partner access. ${emojis.legend}`})

        if (teamName.length > 30) return await interaction.reply({ content: `Sorry, team names must be 30 characters or fewer in length.`})

        const format = await Format.findOne({
            where: {
                [Op.or]: {
                    name: {[Op.iLike]: server.format },
                    channel: interaction.channelId
                }
            }
        })

        const tournament = format ? await Tournament.findOne({
            where: {
                isTeamTournament: true,
                state: 'pending',
                formatId: format.id
            }
        }) : await Tournament.findOne({
            where: {
                isTeamTournament: true,
                state: 'pending'
            }
        })

        if (!tournament) return interaction.reply({ content: `There is no pending team tournament.`})

        const teamExists = await Team.count({
            where: {
                name: teamName
            }
        })

        if (teamExists) return interaction.editReply({ content: `Sorry, the team name, ${teamName}, is already taken for ${tournament.name}.`})

        const captainCount = await Team.count({
            where: {
                tournamentId: tournament.id,
                [Op.or]: {
                    playerAId: captain.id,
                    playerBId: captain.id,
                    playerCId: captain.id
                }
            }
        })

        const teammate1Count = await Team.count({
            where: {
                tournamentId: tournament.id,
                [Op.or]: {
                    playerAId: teammate1.id,
                    playerBId: teammate1.id,
                    playerCId: teammate1.id
                }
            }
        })

        const teammate2Count = await Team.count({
            where: {
                tournamentId: tournament.id,
                [Op.or]: {
                    playerAId: teammate2.id,
                    playerBId: teammate2.id,
                    playerCId: teammate2.id
                }
            }
        })

        if (captainCount) {
            return await interaction.editReply({ content: `Sorry, you're already registered to a team for ${tournament.name}.`})    
        } else if (teammate1Count) {
            return await interaction.editReply({ content: `Sorry, ${teammate1.name} is already registered to a team for ${tournament.name}.`})    
        } else if (teammate2Count) {
            return await interaction.editReply({ content: `Sorry, ${teammate2.name} is already registered to a team for ${tournament.name}.`}) 
        } else {
            const teammates = shuffleArray([captain, teammate1, teammate2])

            const { participant } = await postParticipant(server, tournament, { name: teamName })
            if (!participant) return await interaction.editReply({ content: `Error: Unable to register on Challonge for ${tournament.name} ${tournament.logo}.`})
            
            const team = await Team.create({
                name: teamName,
                captainId: captain.id,
                tournamentId: tournament.id,
                participantId: participant.id,
                playerAId: teammates[0].id,
                playerBId: teammates[1].id,
                playerCId: teammates[2].id,
            })

            const entryA = await Entry.findOne({
                where: {
                    playerId: team.playerAId,
                    tournamentId: tournament.id
                }
            })

            if (entryA) {
                await entryA.update({
                    participantId: team.participantId,
                    teamId: team.id,
                    slot: 'A'
                })
            }

            const entryB = await Entry.findOne({
                where: {
                    playerId: team.playerBId,
                    tournamentId: tournament.id
                }
            })

            if (entryB) {
                await entryB.update({
                    participantId: team.participantId,
                    teamId: team.id,
                    slot: 'B'
                })
            }

            const entryC = await Entry.findOne({
                where: {
                    playerId: team.playerCId,
                    tournamentId: tournament.id
                }
            })

            if (entryC) {
                await entryC.update({
                    participantId: team.participantId,
                    teamId: team.id,
                    slot: 'C'
                })
            }

            return await interaction.editReply({ content: `Congrats! You've registered ${teamName} for ${tournament.name}! ${tournament.logo} ${tournament.emoji}\nCaptain: <@${captain.discordId}>\nTeammate 1: <@${teammate1.discordId}>\nTeammate 2: <@${teammate2.discordId}>`})    
        }
    }
}
