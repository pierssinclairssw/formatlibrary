
import { Format, Match, Player, Stats } from '@fl/models'
import axios from 'axios'

// UNDO MATCH
export const undoMatch = async (server, channel, id) => {
    try {
        const match = await Match.findOne({ where: { id }, include: Format})

        if (match.isTournament && match.tournamentId && match.tournamentMatchId) {
            try {
                await axios({
                    method: 'post',
                    url: `https://api.challonge.com/v1/tournaments/${match.tournamentId}/matches/${match.tournamentMatchId}/reopen.json?api_key=${server.challongeAPIKey}`
                })
            } catch (err) {
                console.log(err)
            }
        }
        
        const winnerId = match.winnerId
        const loserId = match.loserId
        const winningPlayer = await Player.findOne({ where: { id: winnerId } })
        const winnerStats = await Stats.findOne({ where: { playerId: winningPlayer.id, format: match.formatName, serverId: match.serverId } })
        const losingPlayer = await Player.findOne({ where: { id: loserId } })
        const loserStats = await Stats.findOne({ where: { playerId: losingPlayer.id, format: match.formatName, serverId: match.serverId } })
    
        if (!winnerStats.backupElo) channel.send({ content: `${winningPlayer.name} has no backup stats: Remember to **/recalculate** when finished.`})
        if (!loserStats.backupElo) channel.send({ content: `${losingPlayer.name} has no backup stats: Remember to **/recalculate** when finished.`})

        winnerStats.elo = winnerStats.backupElo
        winnerStats.backupElo = null
        winnerStats.wins--
        winnerStats.games--
        await winnerStats.save()
    
        loserStats.elo = loserStats.backupElo
        loserStats.backupElo = null
        loserStats.losses--
        loserStats.games--
        await loserStats.save()
    
        await match.destroy()
        return channel.send({ content: `The last ${server.internalLadder ? 'Internal ' : ''}${match.formatName} Format ${server.emoji || match.format?.emoji || ''} ${match.isTournament ? 'Tournament ' : ''}match in which ${winningPlayer.name} defeated ${losingPlayer.name} has been erased.`})	
    } catch (err) {
        console.log(err)
    }
} 
