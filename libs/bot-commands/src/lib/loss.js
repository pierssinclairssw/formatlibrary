
import { SlashCommandBuilder } from 'discord.js'    
import { createPlayer, isNewUser, hasAffiliateAccess, isIronPlayer, isTourPlayer } from '@fl/bot-functions'
import { postStory } from '@fl/bot-functions'
import { checkPairing, getMatches, processMatchResult, selectTournament } from '@fl/bot-functions'
import { emojis } from '@fl/bot-emojis'
import { Entry, Format, Iron, Match, Matchup, Player, Pool, Server, Stats, Tournament } from '@fl/models'
import { Op } from 'sequelize'

export default {
    data: new SlashCommandBuilder()
        .setName('loss')
        .setDescription(`Report a loss to another player. 💀`)
        .addUserOption(option =>
            option
                .setName('opponent')
                .setDescription('The opponent you lost to.')
                .setRequired(true)
        ),
    async execute(interaction) {
        interaction.deferReply()
        const opponent = interaction.options.getUser('opponent')
        const member = await interaction.guild.members.fetch(interaction.user.id)
        const winner = await interaction.guild.members.fetch(opponent.id)
        
        const server = !interaction.guildId ? {} : 
            await Server.findOne({ where: { id: interaction.guildId }}) || 
            await Server.create({ id: interaction.guildId, name: interaction.guild.name })
    
            if (!hasAffiliateAccess(server)) return interaction.editReply({ content: `This feature is only available with affiliate access. ${emojis.legend}`})
    
            const format = await Format.findOne({
                where: {
                    [Op.or]: {
                        name: { [Op.iLike]: server.format },
                        channel: interaction.channelId
                    }
                }
            })
    
        if (!format) return interaction.editReply({ content: `Try using /loss in channels like: <#414575168174948372> or <#629464112749084673>.`})
        if (opponent.id === interaction.user.id) return interaction.editReply({ content: `You cannot lose a match to yourself.`})
        if (await isNewUser(opponent.id)) await createPlayer(winner)
        const winningPlayer = await Player.findOne({ where: { discordId: opponent.id } })
        const serverId = server.internalLadder ? server.id : '414551319031054346'
        
        const wCount = await Stats.count({ where: { playerId: winningPlayer.id, format: format.name, serverId: serverId } })
        if (!wCount) await Stats.create({ playerId: winningPlayer.id, format: format.name, serverId: serverId, internal: server.internalLadder })
        const winnerStats = await Stats.findOne({ where: { playerId: winningPlayer.id, format: format.name, serverId: serverId } })
        const losingPlayer = await Player.findOne({ where: { discordId: interaction.user.id } })
        const lCount = await Stats.count({ where: { playerId: losingPlayer.id, format: format.name, serverId: serverId } })
        if (!lCount) await Stats.create({ playerId: losingPlayer.id, format: format.name, serverId: serverId, internal: server.internalLadder })
        const loserStats = await Stats.findOne({ where: { playerId: losingPlayer.id, format: format.name, serverId: serverId } })

        if (opponent.bot) return interaction.editReply({ content: `Sorry, Bots do not play ${format.name} Format... *yet*.`})
        if (!losingPlayer || !loserStats) return interaction.editReply({ content: `You are not in the database.`})
        if (!winningPlayer || !winnerStats) return interaction.editReply({ content: `That user is not in the database.`})

        const loserHasTourRole = isTourPlayer(server, member)
        const winnerHasTourRole = isTourPlayer(server, winner)
        const activeTournament = await Tournament.count({ where: { state: 'underway', serverId: interaction.guildId, formatName: format.name } }) 
        let isTournamentMatch
        let winningEntry
        let losingEntry
        let tournament

        const loserHasIronRole = isIronPlayer(server, member)
        const winnerHasIronRole = isIronPlayer(server, winner)
        const activeIron = await Iron.count({ where: { format: format.name, status: 'active' }})
        let isIronMatch

        if (loserHasTourRole && winnerHasTourRole && activeTournament) {
            const loserEntries = await Entry.findAll({ 
                where: { 
                    playerId: losingPlayer.id,
                    '$tournament.formatId$': format.id
                }, 
                include: Tournament 
            })

            const winnerEntries = await Entry.findAll({ 
                where: { 
                    playerId: winningPlayer.id,
                    '$tournament.formatId$': format.id
                }, 
                include: Tournament 
            })
            
            if (loserEntries.length && winnerEntries.length) {
                const loserTournamentIds = []
                const winnerTournamentIds = []
                const commonTournamentIds = []
                const tournaments = []

                for (let i = 0; i < loserEntries.length; i++) {
                    const entry = loserEntries[i]
                    loserTournamentIds.push(entry.tournament.id)
                }

                for (let i = 0; i < winnerEntries.length; i++) {
                    const entry = winnerEntries[i]
                    winnerTournamentIds.push(entry.tournament.id)
                }

                for (let i = 0; i < loserTournamentIds.length; i++) {
                    const tournament_id = loserTournamentIds[i]
                    if (winnerTournamentIds.includes(tournament_id)) {
                        commonTournamentIds.push(tournament_id)
                    }
                }

                if (commonTournamentIds.length) {
                    for (let i = 0; i < commonTournamentIds.length; i++) {
                        const id = commonTournamentIds[i]
                        tournament = await Tournament.findOne({ where: { id: id, serverId: interaction.guildId }})
                        if (!tournament) continue
                        losingEntry = await Entry.findOne({ where: { playerId: losingPlayer.id, tournamentId: tournament.id } })
                        winningEntry = await Entry.findOne({ where: { playerId: winningPlayer.id, tournamentId: tournament.id } })
                        if (!losingEntry || !winningEntry) continue
                        const matches = await getMatches(server, tournament.id)
                        if (!matches) continue
                        for (let i = 0; i < matches.length; i++) {
                            const match = matches[i].match
                            if (match.state !== 'open') continue
                            if (checkPairing(match, losingEntry.participantId, winningEntry.participantId)) {
                                tournaments.push(tournament)
                                break
                            }
                        }
                    }
                }

                if (tournaments.length) {
                    const tournament = await selectTournament(interaction, tournaments, interaction.member.user.id)
                    if (tournament) {
                        isTournamentMatch = true
                        if (tournament.state === 'pending') return interaction.editReply({ content: `Sorry, ${tournament.name} has not started yet.`})
                        if (tournament.state !== 'underway') return interaction.editReply({ content: `Sorry, ${tournament.name} is not underway.`})
                        const success = await processMatchResult(server, interaction, winner, winningPlayer, interaction.member, losingPlayer, tournament)
                        if (!success) return
                    } else {
                        return
                    }
                }
            }
        } else if (loserHasIronRole && winnerHasIronRole && activeIron) {
            const teamA = [...await Iron.findAll({ 
                where: {
                    format: format.name,
                    team: 'A',
                    eliminated: false
                },
                order: [["position", "ASC"]]
            })]
        
            const teamB = [...await Iron.findAll({ 
                where: {
                    format: format.name,
                    team: 'B',
                    eliminated: false
                },
                order: [["position", "ASC"]]
            })]
                    
            const ironPersonA = teamA[0]
            const ironPersonB = teamB[0]

            if (winningPlayer.id === ironPersonA.playerId && losingPlayer.id === ironPersonB.playerId) {
                isIronMatch = true
                ironPersonB.eliminated = true
                await ironPersonB.save()
                setTimeout(() => postStory(interaction.channel, format), 5000)
            } else if (winningPlayer.id === ironPersonB.playerId && losingPlayer.id === ironPersonA.playerId) {
                isIronMatch = true
                ironPersonA.eliminated = true
                await ironPersonA.save()
                setTimeout(() => postStory(interaction.channel, format), 5000)
            } else {
                return interaction.editReply({ content: `Sorry, ${winningPlayer.name} is not your ${format.name} Iron opponent. ${server.emoji || format.emoji} ${emojis.iron}`})
            }
        }
            
        const prevVanq = await Match.count({
            where: {
                format: {[Op.iLike]: format.name},
                winnerId: winningPlayer.id,
                loserId: losingPlayer.id
            }
        })

        const origEloWinner = winnerStats.elo || 500.00
        const origEloLoser = loserStats.elo || 500.00
        const delta = 20 * (1 - (1 - 1 / ( 1 + (Math.pow(10, ((origEloWinner - origEloLoser) / 400))))))
        
        winnerStats.elo = origEloWinner + delta
        if (origEloWinner + delta > winnerStats.bestElo) winnerStats.bestElo = origEloWinner + delta
        winnerStats.backupElo = origEloWinner
        winnerStats.wins++
        winnerStats.games++
        winnerStats.inactive = false
        winnerStats.streak++
        if (winnerStats.streak >= winnerStats.bestStreak) winnerStats.bestStreak++
        if (!prevVanq) winnerStats.vanquished++
        await winnerStats.save()

        loserStats.elo = origEloLoser - delta
        loserStats.backupElo = origEloLoser
        loserStats.losses++
        loserStats.games++
        loserStats.inactive = false
        loserStats.streak = 0
        await loserStats.save()

        const match = await Match.create({
            winner: winningPlayer.name,
            winnerId: winningPlayer.id,
            loser: losingPlayer.name,
            loserId: losingPlayer.id,
            tournament: isTournamentMatch,
            format: format.name,
            delta: delta,
            serverId: serverId,
            internal: server.internalLadder
        })

        if (isTournamentMatch && winningEntry && losingEntry && tournament && match) {
            await Matchup.create({
                matchId: match.id,
                format: format.name,
                tournamentId: tournament.id
            })
        }

        const poolsToUpdate = await Pool.findAll({
            where: {
                playerId: {[Op.or]: [winningPlayer.id, losingPlayer.id]},
                status: 'inactive'
            }
        }) || []

        for (let d = 0; d < poolsToUpdate.length; d++) {
            const rPTU = poolsToUpdate[d]
            await rPTU.update({ status: 'pending' })
        }

        if (!interaction.replied) {
            return interaction.editReply({ content: `${losingPlayer.name}, your ${server.internalLadder ? 'Internal ' : ''}${format.name} Format ${server.emoji || format.emoji} ${isTournamentMatch ? 'Tournament ' : isIronMatch ? `Iron ${emojis.iron}` : ''}loss to <@${winningPlayer.discordId}> has been recorded.`})
        } else {
            return interaction.channel.send({ content: `${losingPlayer.name}, your ${server.internalLadder ? 'Internal ' : ''}${format.name} Format ${server.emoji || format.emoji} ${isTournamentMatch ? 'Tournament ' : isIronMatch ? `Iron ${emojis.iron}` : ''}loss to <@${winningPlayer.discordId}> has been recorded.`})
        }
    }
}

