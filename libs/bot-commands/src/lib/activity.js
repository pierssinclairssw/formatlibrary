
import { SlashCommandBuilder } from 'discord.js'
import { Format, Match, Server } from '@fl/models'
const QuickChart = require('quickchart-js')
import { hasAffiliateAccess } from '@fl/bot-functions'
import { Op } from 'sequelize'
import { emojis } from '@fl/bot-emojis'

export default {
    data: new SlashCommandBuilder()
        .setName('activity')
        .setDescription('Post format activity chart. 🏃'),
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

        if (!format) {
            const today = new Date()
            const cutoff = new Date(
                today.getMonth() === 11 ? today.getFullYear() : today.getFullYear() - 1,
                today.getMonth() === 11 ? 1 : today.getMonth() + 1,
                1
            )
    
            const matches = await Match.findAll({
                where: { 
                    createdAt: {
                        [Op.gte]: cutoff
                    }
                }
            })
    
            const summary = {}
            
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i]
                summary[match.formatName] ? summary[match.formatName]++ : summary[match.formatName] = 1
            }
    
            const labels = []
            const data = []

            const entries = Object.entries(summary).sort((a, b) => b[1] - a[1])

            for (let [key, value] of entries) {
                if (value < 120) continue
                labels.push(key)
                data.push(value)
            }

            const chart = new QuickChart()
            chart.setConfig({
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Activity',
                            backgroundColor: 'rgb(10, 54, 138)',
                            borderColor: 'rgb(10, 54, 138)',
                            data: data,
                            fill: false,
                        }
                    ],
                },
                options: {
                    title: {
                        display: true,
                        text: `Format Library Activity Chart`,
                    },
                    legend: {
                        display: false
                    },
                    scales: {
                        yAxes: [
                            {
                                ticks: {
                                    suggestedMax: 100
                                }
                            }
                        ]
                    },
                },
            })
    
            const url = await chart.getShortUrl()
            return await interaction.reply({ content: `${url}` })
        } else {
            const today = new Date()
            const cutoff = new Date(
                today.getMonth() === 11 ? today.getFullYear() : today.getFullYear() - 1,
                today.getMonth() === 11 ? 1 : today.getMonth() + 1,
                1
            )
    
            const matches = await Match.findAll({
                where: { 
                    formatName: format.name,
                    createdAt: {
                        [Op.gte]: cutoff
                    }
                },
                order: [['createdAt', 'ASC']]
            })
    
            const summary = {
                '0': 0,
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '6': 0,
                '7': 0,
                '8': 0,
                '9': 0,
                '10': 0,
                '11': 0,
            }
            
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i]
                const month = match.createdAt.getMonth()
                summary[month] ? summary[month]++ : summary[month] = 1
            }
    
            const month = new Date().getMonth()
            const months = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ]
    
            const labels = []
            const data = []
            for (let i = month + 1; i <= 11; i++) {
                labels.push(months[i])
                data.push(summary[i])
            }
            for (let i = 0; i <= month; i++) {
                labels.push(months[i])
                data.push(summary[i])
            }
            
            const chart = new QuickChart()
            chart.setConfig({
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Activity',
                            backgroundColor: 'rgb(10, 54, 138)',
                            borderColor: 'rgb(10, 54, 138)',
                            data: data,
                            fill: false,
                        }
                    ],
                },
                options: {
                    title: {
                        display: true,
                        text: `${format.name} Activity Chart`,
                    },
                    legend: {
                        display: false
                    },
                    scales: {
                        yAxes: [
                            {
                                ticks: {
                                    suggestedMax: 100
                                }
                            }
                        ]
                    },
                },
            })
    
            const url = await chart.getShortUrl()
            return await interaction.reply({ content: `${url}` })
        }
    }
}