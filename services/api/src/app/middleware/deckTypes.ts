import { Card, Deck, DeckThumb, DeckType, Format } from '@fl/models'
import { Op } from 'sequelize'
import axios from 'axios'
import * as fs from 'fs'

export const deckTypes = async (req, res, next) => {
  try {
    const deckTypes = await DeckType.findAll({
      attributes: ['id', 'name', 'category'],
      order: [['name', 'ASC']]
    })

    res.json(deckTypes)
  } catch (err) {
    next(err)
  }
}

export const deckTypesName = async (req, res, next) => {
    try {
        const deckType = await DeckType.findOne({
            where: { name: req.params.name },
            attributes: ['id', 'name', 'category'],
            order: [['name', 'ASC']]
        })
    
        res.json(deckType)
    } catch (err) {
        next(err)
    }
}

export const deckTypesDownload = async (req, res, next) => {
    try {
      const format = await Format.findOne({
        where: {
          name: { [Op.iLike]: req.query.format }
        },
        attributes: ['id', 'name', 'banlist', 'date', 'icon']
      })

      const decks =
        (await Deck.findAll({
          where: {
            type: { [Op.iLike]: req.query.id },
            formatId: format.id
          },
          attributes: ['id', 'ydk']
        })) || []

      const data = {
        analyzed: 0,
        main: {},
        mainMonsters: [],
        mainSpells: [],
        mainTraps: [],
        extra: {},
        extraMonsters: [],
        side: {},
        sideMonsters: [],
        sideSpells: [],
        sideTraps: []
      }
  
      for (let i = 0; i < decks.length; i++) {
        const deck = decks[i]
        data.analyzed++
  
        const mainKonamiCodes = deck.ydk
          .split('#main')[1]
          .split('#extra')[0]
          .split('\n')
          .filter((e) => e.length)
        const extraKonamiCodes = deck.ydk
              .split('#extra')[1]
              .split('!side')[0]
              .split('\n')
              .filter((e) => e.length)
        const sideKonamiCodes = deck.ydk
          .split('!side')[1]
          .split('\n')
          .filter((e) => e.length)
  
        const main = mainKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})
        const extra = extraKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})
        const side = sideKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})

        Object.entries(main).forEach((e) => {
          const konamiCode = e[0]
          const count = e[1]
          if (data.main[konamiCode]) {
            data.main[konamiCode][count]++
            data.main[konamiCode].decks++
            data.main[konamiCode].total += count
          } else {
            data.main[konamiCode] = {
              total: count,
              decks: 1,
              1: count === 1 ? 1 : 0,
              2: count === 2 ? 1 : 0,
              3: count === 3 ? 1 : 0
            }
          }
        })
  
        Object.entries(extra).forEach((e) => {
          const konamiCode = e[0]
          const count = e[1]
          if (data.extra[konamiCode]) {
            data.extra[konamiCode][count]++
            data.extra[konamiCode].decks++
            data.extra[konamiCode].total += count
          } else {
            data.extra[konamiCode] = {
              total: count,
              decks: 1,
              1: count === 1 ? 1 : 0,
              2: count === 2 ? 1 : 0,
              3: count === 3 ? 1 : 0
            }
          }
        })
  
        Object.entries(side).forEach((e) => {
          const konamiCode = e[0]
          const count = e[1]
          if (data.side[konamiCode]) {
            data.side[konamiCode][count]++
            data.side[konamiCode].decks++
            data.side[konamiCode].total += count
          } else {
            data.side[konamiCode] = {
              total: count,
              decks: 1,
              1: count === 1 ? 1 : 0,
              2: count === 2 ? 1 : 0,
              3: count === 3 ? 1 : 0
            }
          }
        })
      }
  
      const main = Object.entries(data.main)
  
      for (let j = 0; j < main.length; j++) {
        const e: any = main[j]
        if (e[1].decks < 0.25 * data.analyzed) {
          delete data.main[e[0]]
        } else {
          let konamiCode = e[0]
          while (konamiCode.length < 8) konamiCode = '0' + konamiCode
          const card =
            (await Card.findOne({
              where: {
                konamiCode
              },
              attributes: ['id', 'name', 'category', 'ypdId', 'konamiCode', 'sortPriority']
            })) || {}
  
          data.main[e[0]].card = card
        }
      }
  
      const extra = Object.entries(data.extra)
  
      for (let j = 0; j < extra.length; j++) {
        const e: any = extra[j]
        if (e[1].decks < 0.25 * data.analyzed) {
          delete data.extra[e[0]]
        } else {
          let konamiCode = e[0]
          while (konamiCode.length < 8) konamiCode = '0' + konamiCode
          const card =
            (await Card.findOne({
              where: {
                konamiCode
              },
              attributes: ['id', 'name', 'category', 'ypdId', 'konamiCode', 'sortPriority']
            })) || {}
  
          data.extra[e[0]].card = card
        }
      }
  
      const side = Object.entries(data.side)
  
      for (let j = 0; j < side.length; j++) {
        const e: any = side[j]
        if (e[1].decks < 0.25 * data.analyzed) {
          delete data.side[e[0]]
        } else {
          let konamiCode = e[0]
          while (konamiCode.length < 8) konamiCode = '0' + konamiCode
          const card =
            (await Card.findOne({
              where: {
                konamiCode
              },
              attributes: ['id', 'name', 'category', 'ypdId', 'konamiCode', 'sortPriority']
            })) || {}
  
          data.side[e[0]].card = card
        }
      }
  
      const sortFn = (a, b) => {
        if (a.card.sortPriority > b.card.sortPriority) {
          return 1
        } else if (b.card.sortPriority > a.card.sortPriority) {
          return -1
        } else if (a.card.name > b.card.name) {
          return 1
        } else if (b.card.name > a.card.name) {
          return -1
        } else {
          return 0
        }
      }

      data.mainMonsters = Object.values(data.main).filter((v: any) => v.card.category === 'Monster').sort(sortFn)
      data.mainSpells = Object.values(data.main).filter((v: any) => v.card.category === 'Spell').sort(sortFn)
      data.mainTraps = Object.values(data.main).filter((v: any) => v.card.category === 'Trap').sort(sortFn)
      data.extraMonsters = Object.values(data.extra).sort(sortFn)
      data.sideMonsters = Object.values(data.side).filter((v: any) => v.card.category === 'Monster').sort(sortFn)
      data.sideSpells = Object.values(data.side).filter((v: any) => v.card.category === 'Spell').sort(sortFn)
      data.sideTraps = Object.values(data.side).filter((v: any) => v.card.category === 'Trap').sort(sortFn)

        const mainYdk = []
        const sideYdk = []
        const extraYdk = []

        data.mainMonsters.forEach((el) => {
            const avg = Math.round(el.total / el.decks)
            for (let i = 0; i < avg; i++) mainYdk.push(el.card.konamiCode)
        })

        data.mainSpells.forEach((el) => {
            const avg = Math.round(el.total / el.decks)
            for (let i = 0; i < avg; i++) mainYdk.push(el.card.konamiCode)
        })

        data.mainTraps.forEach((el) => {
            const avg = Math.round(el.total / el.decks)
            for (let i = 0; i < avg; i++) mainYdk.push(el.card.konamiCode)
        })

        data.extraMonsters.forEach((el) => extraYdk.push(el.card.konamiCode))
        data.sideMonsters.forEach((el) => sideYdk.push(el.card.konamiCode))
        data.sideSpells.forEach((el) => sideYdk.push(el.card.konamiCode))
        data.sideTraps.forEach((el) => sideYdk.push(el.card.konamiCode))

        const ydk = ['created by...', '#main', ...mainYdk, '#extra', ...extraYdk, '!side', ...sideYdk, ''].join('\n')
        res.send(ydk)
    } catch (err) {
      console.log(err)
    }
  }

  
export const deckTypesSummary = async (req, res, next) => {
  try {
    const decks =
      (await Deck.findAll({
        where: {
          type: { [Op.iLike]: req.query.id }
        },
        attributes: ['id', 'type', 'category', 'ydk', 'formatName']
      })) || []

    const freqs = decks.reduce(
      (acc, curr) => (acc[curr.formatName] ? acc[curr.formatName]++ : (acc[curr.formatName] = 1), acc),
      {}
    )
    
    const sortedFreqs = Object.entries(freqs).sort((a: never, b: never) => b[1] - a[1])
    const topFormat = sortedFreqs[0][0]
    const format = await Format.findOne({
      where: {
        name: { [Op.iLike]: req.query.format || topFormat }
      },
      attributes: ['id', 'name', 'banlist', 'date', 'icon']
    })

    const showExtra = format.date >= '2008-08-05' || !format.date
    const count = freqs[format.name]
    const total = await Deck.count({
      where: {
        formatName: { [Op.iLike]: format.name }
      }
    })

    const data = {
      percent: Math.round((count / total) * 100) || '<1',
      deckType: decks[0].type,
      deckCategory: decks[0].category,
      analyzed: 0,
      main: {},
      mainMonsters: [],
      mainSpells: [],
      mainTraps: [],
      extra: {},
      extraMonsters: [],
      side: {},
      sideMonsters: [],
      sideSpells: [],
      sideTraps: [],
      format: undefined
    }

    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      if (deck.formatName.toLowerCase() !== format.name.toLowerCase()) continue
      data.analyzed++

      const mainKonamiCodes = deck.ydk
        .split('#main')[1]
        .split('#extra')[0]
        .split('\n')
        .filter((e) => e.length)
      const extraKonamiCodes = showExtra
        ? deck.ydk
            .split('#extra')[1]
            .split('!side')[0]
            .split('\n')
            .filter((e) => e.length)
        : []
      const sideKonamiCodes = deck.ydk
        .split('!side')[1]
        .split('\n')
        .filter((e) => e.length)

      const main = mainKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})
      const extra = showExtra
        ? extraKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})
        : {}
      const side = sideKonamiCodes.reduce((acc, curr) => (acc[curr] ? acc[curr]++ : (acc[curr] = 1), acc), {})

      Object.entries(main).forEach((e) => {
        const konamiCode = e[0]
        const count = e[1]
        if (data.main[konamiCode]) {
          data.main[konamiCode][count]++
          data.main[konamiCode].decks++
          data.main[konamiCode].total += count
        } else {
          data.main[konamiCode] = {
            total: count,
            decks: 1,
            1: count === 1 ? 1 : 0,
            2: count === 2 ? 1 : 0,
            3: count === 3 ? 1 : 0
          }
        }
      })

      Object.entries(extra).forEach((e) => {
        const konamiCode = e[0]
        const count = e[1]
        if (data.extra[konamiCode]) {
          data.extra[konamiCode][count]++
          data.extra[konamiCode].decks++
          data.extra[konamiCode].total += count
        } else {
          data.extra[konamiCode] = {
            total: count,
            decks: 1,
            1: count === 1 ? 1 : 0,
            2: count === 2 ? 1 : 0,
            3: count === 3 ? 1 : 0
          }
        }
      })

      Object.entries(side).forEach((e) => {
        const konamiCode = e[0]
        const count = e[1]
        if (data.side[konamiCode]) {
          data.side[konamiCode][count]++
          data.side[konamiCode].decks++
          data.side[konamiCode].total += count
        } else {
          data.side[konamiCode] = {
            total: count,
            decks: 1,
            1: count === 1 ? 1 : 0,
            2: count === 2 ? 1 : 0,
            3: count === 3 ? 1 : 0
          }
        }
      })
    }

    const main = Object.entries(data.main)

    for (let j = 0; j < main.length; j++) {
      const e: any = main[j]
      if (e[1].decks < 0.25 * data.analyzed) {
        delete data.main[e[0]]
      } else {
        let konamiCode = e[0]
        while (konamiCode.length < 8) konamiCode = '0' + konamiCode
        const card =
          (await Card.findOne({
            where: {
              konamiCode
            },
            attributes: ['id', 'name', 'category', 'ypdId']
          })) || {}

        data.main[e[0]].card = card
      }
    }

    const extra = Object.entries(data.extra)

    for (let j = 0; j < extra.length; j++) {
      const e: any = extra[j]
      if (e[1].decks < 0.25 * data.analyzed) {
        delete data.extra[e[0]]
      } else {
        let konamiCode = e[0]
        while (konamiCode.length < 8) konamiCode = '0' + konamiCode
        const card =
          (await Card.findOne({
            where: {
              konamiCode
            },
            attributes: ['id', 'name', 'category', 'ypdId']
          })) || {}

        data.extra[e[0]].card = card
      }
    }

    const side = Object.entries(data.side)

    for (let j = 0; j < side.length; j++) {
      const e: any = side[j]
      if (e[1].decks < 0.25 * data.analyzed) {
        delete data.side[e[0]]
      } else {
        let konamiCode = e[0]
        while (konamiCode.length < 8) konamiCode = '0' + konamiCode
        const card =
          (await Card.findOne({
            where: {
              konamiCode
            },
            attributes: ['id', 'name', 'category', 'ypdId']
          })) || {}

        data.side[e[0]].card = card
      }
    }

    data.mainMonsters = Object.values(data.main)
      .filter((v: any) => v.card.category === 'Monster')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.mainSpells = Object.values(data.main)
      .filter((v: any) => v.card.category === 'Spell')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.mainTraps = Object.values(data.main)
      .filter((v: any) => v.card.category === 'Trap')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.extraMonsters = Object.values(data.extra).sort((a: any, b: any) => b.decks - a.decks)
    data.sideMonsters = Object.values(data.side)
      .filter((v: any) => v.card.category === 'Monster')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.sideSpells = Object.values(data.side)
      .filter((v: any) => v.card.category === 'Spell')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.sideTraps = Object.values(data.side)
      .filter((v: any) => v.card.category === 'Trap')
      .sort((a: any, b: any) => b.decks - a.decks)
    data.format = format

    res.json(data)
  } catch (err) {
    console.log(err)
  }
}

export const deckTypesCreate = async (req, res, next) => {
  try {
    const deckType =
      (await DeckType.findOne({
        where: {
          name: req.body.name
        }
      })) ||
      (await DeckType.create({
        name: req.body.name,
        category: req.body.category
      }))

    const count = await DeckThumb.count({ where: { name: req.body.name } })

    const deckThumb =
      (await DeckThumb.findOne({
        where: {
          name: req.body.name,
          formatId: req.body.formatId
        }
      })) ||
      (await DeckThumb.create({
        name: deckType.name,
        deckTypeId: deckType.id,
        format: req.body.formatName,
        formatId: req.body.formatId,
        primary: !!count
      }))

    ;(deckThumb.leftCard = req.body.leftCardName),
      (deckThumb.leftCardYpdId = req.body.leftCardYpdId),
      (deckThumb.centerCard = req.body.centerCardName),
      (deckThumb.centerCardYpdId = req.body.centerCardYpdId),
      (deckThumb.rightCard = req.body.rightCardName),
      (deckThumb.rightCardYpdId = req.body.rightCardYpdId),
      await deckThumb.save()

    if (!fs.existsSync(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.leftCardYpdId}.jpg`)) {
      try {
        const { data } = await axios({
          method: 'GET',
          url: `https://storage.googleapis.com/ygoprodeck.com/pics_artgame/${deckThumb.leftCardYpdId}.jpg`,
          responseType: 'stream'
        })

        data.pipe(fs.createWriteStream(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.leftCardYpdId}.jpg`))
        console.log(
          `saved ${deckThumb.leftCard} artwork to ${`https://cdn.formatlibrary.com/images/artworks/${deckThumb.leftCardYpdId}.jpg`}`
        )
      } catch (err) {
        console.log(err)
      }
    }

    if (!fs.existsSync(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.centerCardYpdId}.jpg`)) {
      try {
        const { data } = await axios({
          method: 'GET',
          url: `https://storage.googleapis.com/ygoprodeck.com/pics_artgame/${deckThumb.centerCardYpdId}.jpg`,
          responseType: 'stream'
        })

        data.pipe(fs.createWriteStream(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.centerCardYpdId}.jpg`))
        console.log(
          `saved ${deckThumb.centerCard} artwork to ${`https://cdn.formatlibrary.com/images/artworks/${deckThumb.centerCardYpdId}.jpg`}`
        )
      } catch (err) {
        console.log(err)
      }
    }

    if (!fs.existsSync(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.rightCardYpdId}.jpg`)) {
      try {
        const { data } = await axios({
          method: 'GET',
          url: `https://storage.googleapis.com/ygoprodeck.com/pics_artgame/${deckThumb.rightCardYpdId}.jpg`,
          responseType: 'stream'
        })

        data.pipe(fs.createWriteStream(`https://cdn.formatlibrary.com/images/artworks/${deckThumb.rightCardYpdId}.jpg`))
        console.log(
          `saved ${deckThumb.rightCard} artwork to ${`https://cdn.formatlibrary.com/images/artworks/${deckThumb.rightCardYpdId}.jpg`}`
        )
      } catch (err) {
        console.log(err)
      }
    }

    res.json(deckType)
  } catch (err) {
    next(err)
  }
}
