import { BaseCommand } from '../../structures/Command'
import Discord from 'discord.js'
import Embed from '../../utils/Embed'
import comma from 'comma-number'
import Schema from '../../schemas/Money'
import StockSchema from '../../schemas/Stock'
import config from '../../../config'
import { searchStock, searchStocks, searchStockList } from '../../utils/stock'

export default new BaseCommand(
  {
    name: 'stock',
    description: '주식을 거래합니다. (검색, 매수, 매도, 목록)',
    aliases: ['주식', 'stock', '주식거래', '주식거래하기']
  },
  async (client, message, args) => {
    const type = args[0]
    const embed = new Embed(client, 'info').setTitle('주식')
    if (type === '검색') {
      const keyword = args.slice(1).join(' ')
      const results = await searchStockList(keyword)
      if (!results || results?.items.length == 0) {
        embed.setDescription('검색 결과가 없습니다.')
        return message.reply({ embeds: [embed] })
      }
      const result = await searchStock(results.items[0].code)
      if (!result) {
        embed.setDescription('검색 결과가 없습니다.')
        return message.reply({ embeds: [embed] })
      }
      embed.setTitle(`${results.items[0].name} (${results.items[0].code})`)
      embed.addField('현재가', `${comma(result.now)}원`, true)
      embed.addField(
        '전일대비',
        `${comma(result.diff)}원 (${
          result.risefall == 1 || result.risefall == 2
            ? '▴'
            : result.risefall == 3
            ? '-'
            : '▾'
        } ${comma(result.rate)}%)`,
        true
      )
      embed.addField('거래량', `${comma(result.quant)}주`, true)
      embed.addField('고가', `${comma(result.high)}원`, true)
      embed.addField('저가', `${comma(result.low)}원`, true)
      embed.addField('거래대금', `${comma(result.amount)}백만원`, true)
      embed.setImage(
        `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
      )
      return message.reply({
        embeds: [embed]
      })
    } else if (type === '목록') {
      const keyword = args.slice(1).join(' ')
      const result = await searchStocks(keyword)
      embed.setTitle(`${keyword} 검색 결과`)
      const results = result?.result.d.map((stock, index) => {
        return `${
          stock.rf == '1' || stock.rf == '2' ? '+' : stock.rf == '3' ? ' ' : '-'
        } ${index + 1}. ${stock.nm} (${stock.cd}) [ ${comma(stock.nv)}원 (${
          stock.rf == '1' || stock.rf == '2' ? '▴' : stock.rf == '3' ? '-' : '▾'
        } ${stock.cr}%) ]`
      })
      embed.setDescription('```diff\n' + results?.join('\n') + '```')
      return message.reply({
        embeds: [embed]
      })
    } else if (type === '매수') {
      const keyword = args.slice(2).join(' ')
      const quantity = parseInt(args[1])
      const results = await searchStockList(keyword)
      if (!results || results?.items.length == 0) {
        embed.setDescription(`${keyword} 검색 결과가 없습니다.`)
        return message.reply({ embeds: [embed] })
      }
      const result = await searchStock(results.items[0].code)
      if (!result) {
        embed.setDescription(`${keyword} 검색 결과가 없습니다.`)
        return message.reply({ embeds: [embed] })
      }
      const price = result.now * quantity
      const fee = price * 0.02
      const total = price + fee
      const user = await Schema.findOne({ userid: message.author.id })
      if (!user) {
        embed.setDescription(
          `등록되어 있지 않은 유저인 거 같아요!, 먼저 \`${config.bot.prefix}돈받기\` 명령어로 등록을 해주세요.`
        )
        return message.reply({ embeds: [embed] })
      }
      if (user.money < total) {
        embed.setDescription(
          `${comma(total - user.money)}원이 부족해요!\n잔액은 ${comma(
            user.money
          )}원이에요.`
        )
        return message.reply({ embeds: [embed] })
      }
      embed.setDescription(
        `${results.items[0].name} ${quantity}주(${comma(
          result.now * quantity
        )}원)을 매수하시겠습니까?`
      )
      embed.addField('현재가', `${comma(result.now)}원`, true)
      embed.addField('수수료', `${comma(fee)}원 (2%)`, true)
      embed.addField('총계', `${comma(total)}원`, true)
      embed.setImage(
        `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
      )
      const row = new Discord.MessageActionRow()
        .addComponents(
          new Discord.MessageButton()
            .setCustomId('stock.accept')
            .setLabel('확인')
            .setStyle('SUCCESS')
        )
        .addComponents(
          new Discord.MessageButton()
            .setCustomId('stock.deny')
            .setLabel('아니요')
            .setStyle('DANGER')
        )
      const m = await message.reply({ embeds: [embed], components: [row] })
      const collector = m.createMessageComponentCollector({ time: 10000 })
      collector.on('collect', async (i) => {
        if (i.user.id != message.author.id) return
        if (i.customId == 'stock.accept') {
          embed.setDescription(
            `${results.items[0].name} ${quantity}주를 매수했어요!`
          )
          embed.addField('현재가', `${comma(result.now)}원`, true)
          embed.addField('수수료', `${comma(fee)}원 (2%)`, true)
          embed.addField('총계', `${comma(total)}원`, true)
          embed.setImage(
            `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
          )
          await m.edit({ embeds: [embed] })
          await Schema.findOneAndUpdate(
            {
              userid: message.author.id
            },
            {
              $inc: { money: -total }
            }
          )
          await StockSchema.updateOne(
            { userid: message.author.id },
            {
              $push: {
                stocks: {
                  code: results.items[0].code,
                  quantity,
                  name: results.items[0].name,
                  price: result.now
                }
              }
            },
            { upsert: true }
          )
          const successEmbed = new Embed(client, 'success')
            .setTitle(`주식`)
            .setDescription(
              `${results.items[0].name} ${quantity}주를 매수했어요!`
            )
            .addField('거래금액', `${comma(total)}원`, true)
            .addField('수수료', `${comma(fee)}원 (2%)`, true)
            .addField('거래후 잔액', `${comma(user.money - total)}원`, true)
          return i.update({ embeds: [successEmbed], components: [] })
        } else if (i.customId == 'stock.deny') {
          embed.setDescription(`매수를 취소하였습니다.`)
          return i.update({ embeds: [embed], components: [] })
        }
      })
      collector.on('end', (collected) => {
        if (collected.size == 1) return
        m.edit({
          embeds: [embed],
          components: [
            new Discord.MessageActionRow()
              .addComponents(
                new Discord.MessageButton()
                  .setCustomId('stock.accept')
                  .setLabel('확인')
                  .setStyle('SUCCESS')
                  .setDisabled(true)
              )
              .addComponents(
                new Discord.MessageButton()
                  .setCustomId('stock.deny')
                  .setLabel('아니요')
                  .setStyle('DANGER')
                  .setDisabled(true)
              )
          ]
        })
      })
    } else if (type === '매도') {
    } else {
      embed.setDescription(
        `\`${config.bot.prefix}주식 목록 (검색어)\` 검색어에 관련된 주식들을 찾아줍니다\n\`${config.bot.prefix}주식 검색 (검색어)\` 검색어에 관련된 주식을 찾아줍니다\n\`${config.bot.prefix}주식 매수 (개수) (이름)\` 입력하신 주식을 개수만큼 매도합니다\n\`${config.bot.prefix}주식 매도 (개수) (이름)\` 입력하신 주식을 개수만큼 매수합니다\n\`${config.bot.prefix}주식 보유\` 보유중인 주식을 확인합니다`
      )
      return message.reply({
        embeds: [embed]
      })
    }
  }
)
