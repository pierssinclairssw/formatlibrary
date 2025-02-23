
import { Sequelize } from 'sequelize'
import { db } from './db'

export const Match = db.define('matches', {
    formatName: {
        type: Sequelize.STRING
    },
    formatId: {
      type: Sequelize.INTEGER
    },
    winner: {
        type: Sequelize.STRING
    },
    winnerId: {
        type: Sequelize.STRING
    },
    loser: {
        type: Sequelize.STRING
    },
    loserId: {
        type: Sequelize.STRING
    },
    delta: {
        type: Sequelize.FLOAT,  
        defaultValue: 10.00
    },
    isTournament: {
        type: Sequelize.BOOLEAN,   
        defaultValue: false
    },
    tournamentId: {
        type: Sequelize.STRING,
    },
    tournamentMatchId: {
        type: Sequelize.INTEGER
    },
    internal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }
})