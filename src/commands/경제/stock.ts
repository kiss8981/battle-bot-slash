import { BaseCommand } from '../../structures/Command'
import Discord, {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageComponent
} from 'discord.js'
import Embed from '../../utils/Embed'
import comma from 'comma-number'
import Schema from '../../schemas/Money'
import StockSchema, { Stock } from '../../schemas/Stock'
import config from '../../../config'
import {
  searchStock,
  searchStocks,
  searchStockList,
  stock
} from '../../utils/stock'
import { SlashCommandBuilder, userMention } from '@discordjs/builders'

export default new BaseCommand(
  {
    name: 'stock',
    description: '주식을 거래합니다. (검색, 매수, 매도, 목록)',
    aliases: ['주식', 'stock', '주식거래', '주식거래하기'],
  },
  async (client, message, args) => {
    const type = args[0]
    const embed = new Embed(client, 'info').setColor('#2f3136')
    if (type === '검색' || type == 'search') {
      const keyword = args.slice(1).join(' ')
      const results = await searchStockList(keyword)
      if (!results || results?.items.length == 0) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound')
        )
        return message.reply({ embeds: [embed] })
      }
      const result = await searchStock(results.items[0].code);
      if (!result) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound')
        )
        return message.reply({ embeds: [embed] })
      }
      embed.setTitle(`${results.items[0].name} (${results.items[0].code})`)
      embed.addFields(
        {
          name: client.i18n.t('commands.stock.fields.nowprice'),
          value: client.i18n.t('commands.stock.fields.nowpricev', {
            now: comma(result.now)
          }),
          inline: true
        },
        {
          name: client.i18n.t('commands.stock.fields.dtd'),
          value: client.i18n.t('commands.stock.fields.dtdv', {
            diff: comma(result.diff),
            check:
              result.risefall == 1 || result.risefall == 2
                ? '▴'
                : result.risefall == 3
                  ? '-'
                  : '▾',
            rate: comma(result.rate)
          }),
          inline: true
        }
      )
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.trade'),
        value: client.i18n.t('commands.stock.fields.tradev', {
          quant: comma(result.quant)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.highp'),
        value: client.i18n.t('commands.stock.fields.highpv', {
          high: comma(result.high)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.lowp'),
        value: client.i18n.t('commands.stock.fields.lowpv', {
          low: comma(result.low)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.tamount'),
        value: client.i18n.t('commands.stock.fields.tamountv', {
          amount: comma(result.amount)
        }),
        inline: true
      })
      embed.setImage(
        `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
      );
      return message.reply({
        embeds: [embed]
      })
    } else if (type === '목록' || type === 'list') {
      const keyword = args.slice(1).join(' ')
      const result = await searchStocks(keyword)
      embed.setTitle(
        client.i18n.t('commands.stock.title.search', {
          keyword: keyword
        })
      )
      const results = result?.result.d.map((stock, index) => {
        return `${stock.rf == '1' || stock.rf == '2' ? '+' : stock.rf == '3' ? ' ' : '-'
          } ${index + 1}. ${stock.nm} (${stock.cd}) [ ${comma(stock.nv)}₩ (${stock.rf == '1' || stock.rf == '2' ? '▴' : stock.rf == '3' ? '-' : '▾'
          } ${stock.cr}%) ]`
      })
      embed.setDescription('```diff\n' + results?.join('\n') + '```')
      return message.reply({
        embeds: [embed]
      })
    } else if (type === '매수' || type === 'buy') {
      const keyword = args.slice(2).join(' ')
      const quantity = parseInt(args[1])
      if (!quantity) {
        embed.setDescription(client.i18n.t('commands.stock.description.bint'))
        return message.reply({ embeds: [embed] })
      }
      if (quantity < 1) {
        embed.setDescription(client.i18n.t('commands.stock.description.bupto1'))
        return message.reply({ embeds: [embed] })
      }
      const results = await searchStockList(keyword);
      if (!results || results?.items.length == 0) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound2', {
            keyword: keyword
          })
        )
        return message.reply({ embeds: [embed] })
      }
      const result = await searchStock(results.items[0].code);
      if (!result) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound2', {
            keyword: keyword
          })
        )
        return message.reply({ embeds: [embed] })
      }
      const price = result.now * quantity;
      const fee = price * 0.02;
      const total = price + fee;
      const user = await Schema.findOne({ userid: message.author.id });
      if (!user) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.accountnf', {
            prefix: config.bot.prefix
          })
        )
        return message.reply({ embeds: [embed] })
      }
      if (user.money < total) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.lack', {
            howlack: comma(total - user.money),
            howhave: comma(user.money)
          })
        )
        return message.reply({ embeds: [embed] })
      }
      embed.setDescription(
        client.i18n.t('commands.stock.description.buy', {
          item: results.items[0].name,
          quantity: quantity,
          rnow: comma(result.now * quantity)
        })
      )
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.nowprice'),
        value: client.i18n.t('commands.stock.fields.nowpricev', {
          now: comma(result.now)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.fee'),
        value: client.i18n.t('commands.stock.fields.feev', {
          fee: comma(fee)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.sum'),
        value: client.i18n.t('commands.stock.fields.sumv', {
          total: comma(total)
        }),
        inline: true
      })
      embed.setImage(
        `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
      )
      const row = new Discord.ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('stock.accept')
            .setLabel(client.i18n.t('commands.stock.button.accept'))
            .setStyle(ButtonStyle.Success)
        )
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('stock.deny')
            .setLabel(client.i18n.t('commands.stock.button.cancel'))
            .setStyle(ButtonStyle.Danger)
        )
      const m = await message.reply({ embeds: [embed], components: [row] })
      const collector = m.createMessageComponentCollector<ComponentType.Button>(
        { time: 10000 }
      )
      // @ts-ignore
      collector.on('collect', async (i) => {
        if (i.user.id != message.author.id) return;
        if (i.customId == 'stock.accept') {
          embed.setTitle(client.i18n.t('commands.stock.title.success'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.bsuccess', {
              item: results.items[0].name,
              quantity: quantity
            })
          )
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.nowprice'),
            value: client.i18n.t('commands.stock.fields.nowpricev', {
              now: comma(result.now)
            }),
            inline: true
          })
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.fee'),
            value: client.i18n.t('commands.stock.fields.feev', {
              fee: comma(fee)
            }),
            inline: true
          })
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.sum'),
            value: client.i18n.t('commands.stock.fields.sumv', {
              total: comma(total)
            }),
            inline: true
          })
          embed.setImage(
            `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
          );
          await m.edit({ embeds: [embed] });
          await Schema.findOneAndUpdate(
            {
              userid: message.author.id,
            },
            {
              $inc: { money: -total },
            },
          );
          const nowStock = await StockSchema.findOne({
            userid: message.author.id,
            'stocks.code': results.items[0].code,
          });
          if (!nowStock) {
            await StockSchema.updateOne(
              { userid: message.author.id },
              {
                $push: {
                  stocks: {
                    code: results.items[0].code,
                    quantity,
                    name: results.items[0].name,
                    price: result.now,
                  },
                },
              },
              { upsert: true },
            );
          } else {
            await StockSchema.findOneAndUpdate(
              { userid: message.author.id },
              { $pull: { stocks: { code: results.items[0].code } } },
            );
            await StockSchema.updateOne(
              { userid: message.author.id },
              {
                $push: {
                  stocks: {
                    code: results.items[0].code,
                    quantity: nowStock.stocks[0].quantity + quantity,
                    name: results.items[0].name,
                    price:
                      (nowStock.stocks[0].quantity * nowStock.stocks[0].price +
                        result.now * quantity) /
                      (nowStock.stocks[0].quantity + quantity),
                  },
                },
              },
              { upsert: true },
            );
          }
          const successEmbed = new Embed(client, 'success')
          successEmbed.setTitle(client.i18n.t('commands.stock.title.success'))
          successEmbed
            .setDescription(
              client.i18n.t('commands.stock.description.bsuccess', {
                item: results.items[0].name,
                quantity: quantity
              })
            )
            .addFields({
              name: client.i18n.t('commands.stock.fields.tamount2'),
              value: client.i18n.t('commands.stock.fields.tamount2v', {
                total: comma(total)
              }),
              inline: true
            })
            .addFields({
              name: client.i18n.t('commands.stock.fields.fee'),
              value: client.i18n.t('commands.stock.fields.feev', {
                fee: comma(fee)
              }),
              inline: true
            })
            .addFields({
              name: client.i18n.t('commands.stock.fields.balance'),
              value: client.i18n.t('commands.stock.fields.balancev', {
                minus: comma(user.money - total)
              }),
              inline: true
            })
            .setColor('#2f3136')
          return i.update({ embeds: [successEmbed], components: [] })
        } else if (i.customId == 'stock.deny') {
          embed.setTitle(client.i18n.t('commands.stock.title.cancel'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.bcancel')
          )
          return i.update({ embeds: [embed], components: [] })
        }
      });
      collector.on('end', (collected) => {
        if (collected.size == 1) return;
        m.edit({
          embeds: [embed],
          components: [
            new Discord.ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId('stock.accept')
                  .setLabel(client.i18n.t('commands.stock.button.accept'))
                  .setStyle(ButtonStyle.Success)
                  .setDisabled(true)
              )
              .addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId('stock.deny')
                  .setLabel(client.i18n.t('commands.stock.button.cancel'))
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(true)
              )
          ]
        })
      })
    } else if (type === '매도' || type === 'sell') {
      const keyword = args.slice(2).join(' ')
      const quantity = parseInt(args[1])
      if (!quantity) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(client.i18n.t('commands.stock.description.sint'))
        return message.reply({ embeds: [embed] })
      }
      if (quantity < 1) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(client.i18n.t('commands.stock.description.supto1'))
        return message.reply({ embeds: [embed] })
      }
      const results = await searchStockList(keyword);
      if (!results || results?.items.length == 0) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound2', {
            keyword: keyword
          })
        )
        return message.reply({ embeds: [embed] })
      }
      const result = await searchStock(results.items[0].code);
      if (!result) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.notfound2', {
            keyword: keyword
          })
        )
        return message.reply({ embeds: [embed] })
      }
      const stock = await StockSchema.findOne({
        userid: message.author.id,
        'stocks.code': results.items[0].code,
      });
      if (!stock || stock.stocks.length === 0) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.dhave', {
            item: results.items[0].name
          })
        )
        return message.reply({ embeds: [embed] })
      }
      if (stock.stocks[0].quantity < quantity) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.dhave2', {
            item: results.items[0].name,
            quantity: quantity,
            nowhave: stock.stocks[0].quantity
          })
        )
        return message.reply({ embeds: [embed] })
      }
      const price = result.now * quantity;
      const fee = price * 0.02;
      const total = price - fee;
      const user = await Schema.findOne({ userid: message.author.id });
      if (!user) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.accountnf', {
            prefix: config.bot.prefix
          })
        )
        return message.reply({ embeds: [embed] })
      }
      embed.setDescription(
        client.i18n.t('commands.stock.description.sell', {
          item: results.items[0].name,
          quantity: quantity,
          rnow: comma(result.now * quantity)
        })
      )
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.nowprice'),
        value: client.i18n.t('commands.stock.fields.nowpricev', {
          now: comma(result.now)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.fee'),
        value: client.i18n.t('commands.stock.fields.feev', {
          fee: comma(fee)
        }),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.sum'),
        value: client.i18n.t('commands.stock.fields.sumv', {
          total: comma(total)
        }),
        inline: true
      })
      embed.setImage(
        `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
      )
      const row = new Discord.ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('stocksell.accept')
            .setLabel(client.i18n.t('commands.stock.button.accept'))
            .setStyle(ButtonStyle.Success)
        )
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('stocksell.deny')
            .setLabel(client.i18n.t('commands.stock.button.cancel'))
            .setStyle(ButtonStyle.Danger)
        )
      const m = await message.reply({ embeds: [embed], components: [row] })
      const collector = m.createMessageComponentCollector({ time: 10000 })
      // @ts-ignore
      collector.on('collect', async (i) => {
        if (i.user.id != message.author.id) return;
        if (i.customId == 'stocksell.accept') {
          embed.setTitle(client.i18n.t('commands.stock.title.success2'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.ssuccess', {
              item: results.items[0].name,
              quantity: quantity
            })
          )
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.nowprice'),
            value: client.i18n.t('commands.stock.fields.nowpricev', {
              now: comma(result.now)
            }),
            inline: true
          })
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.fee'),
            value: client.i18n.t('commands.stock.fields.feev', {
              fee: comma(fee)
            }),
            inline: true
          })
          embed.addFields({
            name: client.i18n.t('commands.stock.fields.sum'),
            value: client.i18n.t('commands.stock.fields.sumv', {
              total: comma(total)
            }),
            inline: true
          })
          embed.setImage(
            `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
          );
          await m.edit({ embeds: [embed] });
          await Schema.findOneAndUpdate(
            {
              userid: message.author.id,
            },
            {
              $inc: { money: +total },
            },
          );
          await StockSchema.findOneAndUpdate(
            { userid: message.author.id },
            { $pull: { stocks: { code: stock.stocks[0].code } } },
          );
          await StockSchema.updateOne(
            { userid: message.author.id },
            {
              $push: {
                stocks: {
                  code: results.items[0].code,
                  quantity: stock.stocks[0].quantity - quantity,
                  name: results.items[0].name,
                  price: stock.stocks[0].price,
                },
              },
            },
          );
          const successEmbed = new Embed(client, 'success')
            .setTitle(client.i18n.t('commands.stock.title.success2'))
            .setDescription(
              client.i18n.t('commands.stock.description.ssuccess', {
                item: results.items[0].name,
                quantity: quantity
              })
            )
            .addFields({
              name: client.i18n.t('commands.stock.fields.tamount2'),
              value: client.i18n.t('commands.stock.fields.tamount2v', {
                total: comma(total)
              }),
              inline: true
            })
            .addFields({
              name: client.i18n.t('commands.stock.fields.fee'),
              value: client.i18n.t('commands.stock.fields.feev', {
                fee: comma(fee)
              }),
              inline: true
            })
            .addFields({
              name: client.i18n.t('commands.stock.fields.balance'),
              value: client.i18n.t('commands.stock.fields.balancev', {
                minus: comma(user.money + total)
              }),
              inline: true
            })
            .setColor('#2f3136')
          return i.update({ embeds: [successEmbed], components: [] })
        } else if (i.customId == 'stocksell.deny') {
          embed.setTitle(client.i18n.t('commands.stock.title.cancel2'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.scancel')
          )
          return i.update({ embeds: [embed], components: [] })
        }
      });
      collector.on('end', (collected) => {
        if (collected.size == 1) return;
        m.edit({
          embeds: [embed],
          components: [
            new Discord.ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId('stock.accept')
                  .setLabel(client.i18n.t('commands.stock.button.accept'))
                  .setStyle(ButtonStyle.Success)
                  .setDisabled(true)
              )
              .addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId('stock.deny')
                  .setLabel(client.i18n.t('commands.stock.button.cancel'))
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(true)
              )
          ]
        })
      })
    } else if (args[0] == '보유') {
      const nowStock = await StockSchema.findOne({ userid: message.author.id });
      if (!nowStock) {
        embed.setTitle(client.i18n.t('main.title.error'))
        embed.setDescription(
          client.i18n.t('commands.stock.description.dhave', {
            prefix: config.bot.prefix
          })
        )
        return message.reply({
          embeds: [embed],
        });
      } else {
        embed.setTitle(
          client.i18n.t('commands.stock.title.ahave', {
            author: message.author.username
          })
        )

        const results = await Promise.all(
          nowStock.stocks.map(async (stock, index) => {
            const stockSearch = await searchStock(stock.code);
            if (!stockSearch)
              return client.i18n.t('commands.stock.message.message', {
                i: index + 1,
                name: stock.name,
                quantity: stock.quantity,
                sum: comma(Math.round(stock.price * stock.quantity))
              })
            return client.i18n.t('commands.stock.message.message2', {
              i: index + 1,
              name: stock.name,
              quantity: stock.quantity,
              sum: comma(Math.round(stock.price * stock.quantity)),
              first:
                Math.round(stockSearch.now) > Math.round(stock.price)
                  ? '-'
                  : Math.round(stockSearch.now) < Math.round(stock.price)
                    ? '+'
                    : ' ',
              second:
                Math.round(stockSearch.now * stock.quantity) >
                  Math.round(stock.price * stock.quantity)
                  ? '▾'
                  : Math.round(stockSearch.now * stock.quantity) <
                    Math.round(stock.price * stock.quantity)
                    ? '▴'
                    : '-'
            })
          })
        )
        embed.setDescription('```diff\n' + results.join('\n') + '```')
        return message.reply({
          embeds: [embed],
        });
      }
    } else {
      embed.setTitle(client.i18n.t('commands.stock.title.stockhelp'))
      embed.setDescription(client.i18n.t('commands.stock.description.help'))
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.helplist', {
          prefix: config.bot.prefix
        }),
        value: client.i18n.t('commands.stock.fields.helplistv'),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.helpsearch', {
          prefix: config.bot.prefix
        }),
        value: client.i18n.t('commands.stock.fields.helpsearchv'),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.helpbuy', {
          prefix: config.bot.prefix
        }),
        value: client.i18n.t('commands.stock.fields.helpbuyv'),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.helpsell', {
          prefix: config.bot.prefix
        }),
        value: client.i18n.t('commands.stock.fields.helpsellv'),
        inline: true
      })
      embed.addFields({
        name: client.i18n.t('commands.stock.fields.helphave', {
          prefix: config.bot.prefix
        }),
        value: client.i18n.t('commands.stock.fields.helphavev'),
        inline: true
      })
      return message.reply({
        embeds: [embed]
      })
    }
  },
  {
    // @ts-ignore
    data: new SlashCommandBuilder()
      .setName('주식')
      .setDescription('주식을 거래합니다.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('검색')
          .setDescription('검색한 주식의 상세 정보를 확인합니다.')
          .addStringOption((options) =>
            options
              .setName('주식')
              .setDescription('특정 주식 키워드의 업력해주세요.')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('목록')
          .setDescription('검색한 주식들의 목록을 확인합니다')
          .addStringOption((options) =>
            options
              .setName('주식')
              .setDescription('특정 키워드의 주식들을 검색하려면 업력해주세요.')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('매수')
          .setDescription('입력한 주식을 개수만큼 매수합니다.')
          .addStringOption((options) =>
            options
              .setName('개수')
              .setDescription('매도하실 주식의 수량을 입력해주세요.')
              .setRequired(false)
          )
          .addStringOption((options) =>
            options
              .setName('주식명')
              .setDescription('매도하실 주식의 이름을 입력해주세요.')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('매도')
          .setDescription('입력한 주식을 개수만큼 매도합니다.')
          .addStringOption((options) =>
            options
              .setName('개수')
              .setDescription('매도하실 주식의 수량을 입력해주세요.')
              .setRequired(false)
          )
          .addStringOption((options) =>
            options
              .setName('주식명')
              .setDescription('매도하실 주식의 이름을 입력해주세요.')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommands) =>
        subcommands
          .setName('보유')
          .setDescription('보유중인 주식을 확인합니다.')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('도움말')
          .setDescription('주식에 대한 도움말을 보여줍니다.')
      ),
    async execute(client, interaction) {
      if (!interaction.inCachedGuild()) return
      await interaction.deferReply({ ephemeral: true })
      let embeds = new Embed(client, 'warn')
        .setTitle('처리중..')
        .setColor('#2f3136')
      let m = await interaction.editReply({
        embeds: [embeds]
      })
      const type = interaction.options.getSubcommand()
      const embed = new Embed(client, 'info').setColor('#2f3136')
      if (type === '검색') {
        const keyword = interaction.options.getString('주식') || ''
        const results = await searchStockList(keyword)
        if (!results || results?.items.length == 0) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound')
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const result = await searchStock(results.items[0].code);
        if (!result) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound')
          )
          return interaction.editReply({ embeds: [embed] })
        }
        embed.setTitle(`${results.items[0].name} (${results.items[0].code})`)
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.nowprice'),
          value: client.i18n.t('commands.stock.fields.nowpricev', {
            now: comma(result.now)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.dtd'),
          value: client.i18n.t('commands.stock.fields.dtdv', {
            diff: comma(result.diff),
            check:
              result.risefall == 1 || result.risefall == 2
                ? '▴'
                : result.risefall == 3
                  ? '-'
                  : '▾',
            rate: comma(result.rate)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.trade'),
          value: client.i18n.t('commands.stock.fields.tradev', {
            quant: comma(result.quant)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.highp'),
          value: client.i18n.t('commands.stock.fields.highpv', {
            high: comma(result.high)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.lowp'),
          value: client.i18n.t('commands.stock.fields.lowpv', {
            low: comma(result.low)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.tamount'),
          value: client.i18n.t('commands.stock.fields.tamountv', {
            amount: comma(result.amount)
          }),
          inline: true
        })
        embed.setImage(
          `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
        );
        return interaction.editReply({
          embeds: [embed],
        });
      }
      if (type === '목록') {
        const keyword = interaction.options.getString('주식') || ''
        const result = await searchStocks(keyword)
        embed.setTitle(
          client.i18n.t('commands.stock.title.search', {
            keyword: keyword
          })
        )
        const results = result?.result.d.map((stock, index) => {
          return `${stock.rf == '1' || stock.rf == '2'
              ? '+'
              : stock.rf == '3'
                ? ' '
                : '-'
            } ${index + 1}. ${stock.nm} (${stock.cd}) [ ${comma(stock.nv)}₩ (${stock.rf == '1' || stock.rf == '2'
              ? '▴'
              : stock.rf == '3'
                ? '-'
                : '▾'
            } ${stock.cr}%) ]`
        })
        embed.setDescription('```diff\n' + results?.join('\n') + '```')
        return interaction.editReply({
          embeds: [embed],
        });
      }
      if (type === '매수') {
        const keyword = interaction.options.getString('주식명') || ''
        const quantity = Number(interaction.options.getString('개수')) || 0
        if (!quantity) {
          embed.setDescription(client.i18n.t('commands.stock.description.bint'))
          return interaction.editReply({ embeds: [embed] })
        }
        if (quantity < 1) {
          embed.setDescription(
            client.i18n.t('commands.stock.description.bupto1')
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const results = await searchStockList(keyword);
        if (!results || results?.items.length == 0) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound2', {
              keyword: keyword
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const result = await searchStock(results.items[0].code);
        if (!result) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound2', {
              keyword: keyword
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const price = result.now * quantity;
        const fee = price * 0.02;
        const total = price + fee;
        const user = await Schema.findOne({ userid: interaction.user.id });
        if (!user) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.accountnf', {
              prefix: config.bot.prefix
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        if (user.money < total) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.lack', {
              howlack: comma(total - user.money),
              howhave: comma(user.money)
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        embed.setDescription(
          `${results.items[0].name} ${quantity}주(${comma(
            result.now * quantity
          )}원)을 매수하시겠습니까?`
        )
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.nowprice'),
          value: client.i18n.t('commands.stock.fields.nowpricev', {
            now: comma(result.now)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.fee'),
          value: client.i18n.t('commands.stock.fields.feev', {
            fee: comma(fee)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.sum'),
          value: client.i18n.t('commands.stock.fields.sumv', {
            total: comma(total)
          }),
          inline: true
        })
        embed.setImage(
          `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
        )
        const row = new Discord.ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('stock.accept')
              .setLabel(client.i18n.t('commands.stock.button.accept'))
              .setStyle(ButtonStyle.Success)
          )
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('stock.deny')
              .setLabel(client.i18n.t('commands.stock.button.cancel'))
              .setStyle(ButtonStyle.Danger)
          )
        const m = await interaction.editReply({
          embeds: [embed],
          components: [row]
        })
        if (!interaction.channel) return
        const collector =
          interaction.channel.createMessageComponentCollector<ComponentType.Button>(
            {
              time: 10000
            }
          )
        // @ts-ignore
        collector.on('collect', async (i) => {
          if (i.user.id != interaction.user.id) return;
          if (i.customId == 'stock.accept') {
            embed.setTitle(client.i18n.t('commands.stock.title.success'))
            embed.setDescription(
              client.i18n.t('commands.stock.description.bsuccess', {
                item: results.items[0].name,
                quantity: quantity
              })
            )
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.nowprice'),
              value: client.i18n.t('commands.stock.fields.nowpricev', {
                now: comma(result.now)
              }),
              inline: true
            })
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.fee'),
              value: client.i18n.t('commands.stock.fields.feev', {
                fee: comma(fee)
              }),
              inline: true
            })
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.sum'),
              value: client.i18n.t('commands.stock.fields.sumv', {
                total: comma(total)
              }),
              inline: true
            })
            embed.setImage(
              `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
            );
            await interaction.editReply({ embeds: [embed] });
            await Schema.findOneAndUpdate(
              {
                userid: interaction.user.id,
              },
              {
                $inc: { money: -total },
              },
            );
            const nowStock = await StockSchema.findOne({
              userid: interaction.user.id,
              'stocks.code': results.items[0].code,
            });
            if (!nowStock) {
              await StockSchema.updateOne(
                { userid: interaction.user.id },
                {
                  $push: {
                    stocks: {
                      code: results.items[0].code,
                      quantity,
                      name: results.items[0].name,
                      price: result.now,
                    },
                  },
                },
                { upsert: true },
              );
            } else {
              await StockSchema.findOneAndUpdate(
                { userid: interaction.user.id },
                { $pull: { stocks: { code: results.items[0].code } } },
              );
              await StockSchema.updateOne(
                { userid: interaction.user.id },
                {
                  $push: {
                    stocks: {
                      code: results.items[0].code,
                      quantity: nowStock.stocks[0].quantity + quantity,
                      name: results.items[0].name,
                      price:
                        (nowStock.stocks[0].quantity *
                          nowStock.stocks[0].price +
                          result.now * quantity) /
                        (nowStock.stocks[0].quantity + quantity),
                    },
                  },
                },
                { upsert: true },
              );
            }
            const successEmbed = new Embed(client, 'success')
            successEmbed.setTitle(client.i18n.t('commands.stock.title.success'))
            successEmbed
              .setDescription(
                client.i18n.t('commands.stock.description.bsuccess', {
                  item: results.items[0].name,
                  quantity: quantity
                })
              )
              .addFields({
                name: client.i18n.t('commands.stock.fields.tamount2'),
                value: client.i18n.t('commands.stock.fields.tamount2v', {
                  total: comma(total)
                }),
                inline: true
              })
              .addFields({
                name: client.i18n.t('commands.stock.fields.fee'),
                value: client.i18n.t('commands.stock.fields.feev', {
                  fee: comma(fee)
                }),
                inline: true
              })
              .addFields({
                name: client.i18n.t('commands.stock.fields.balance'),
                value: client.i18n.t('commands.stock.fields.balancev', {
                  minus: comma(user.money - total)
                }),
                inline: true
              })
              .setColor('#2f3136')
            return i.update({ embeds: [successEmbed], components: [] })
          } else if (i.customId == 'stock.deny') {
            embed.setTitle(client.i18n.t('commands.stock.title.cancel'))
            embed.setDescription(
              client.i18n.t('commands.stock.description.bcancel')
            )
            return i.update({ embeds: [embed], components: [] })
          }
        });
        collector.on('end', (collected) => {
          if (collected.size == 1) return;
          interaction.editReply({
            embeds: [embed],
            components: [
              new Discord.ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new Discord.ButtonBuilder()
                    .setCustomId('stock.accept')
                    .setLabel(client.i18n.t('commands.stock.button.accept'))
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                )
                .addComponents(
                  new Discord.ButtonBuilder()
                    .setCustomId('stock.deny')
                    .setLabel(client.i18n.t('commands.stock.button.cancel'))
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
                )
            ]
          })
        })
      }
      if (type === '매도') {
        const keyword = interaction.options.getString('주식명') || ''
        const quantity = Number(interaction.options.getString('개수')) || 0
        if (!quantity) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(client.i18n.t('commands.stock.description.sint'))
          return interaction.editReply({ embeds: [embed] })
        }
        if (quantity < 1) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.supto1')
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const results = await searchStockList(keyword);
        if (!results || results?.items.length == 0) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound2', {
              keyword: keyword
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const result = await searchStock(results.items[0].code);
        if (!result) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.notfound2', {
              keyword: keyword
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const stock = await StockSchema.findOne({
          userid: interaction.user.id,
          'stocks.code': results.items[0].code,
        });
        if (!stock || stock.stocks.length === 0) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.dhave', {
              item: results.items[0].name
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        if (stock.stocks[0].quantity < quantity) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.dhave2', {
              item: results.items[0].name,
              quantity: quantity,
              nowhave: stock.stocks[0].quantity
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        const price = result.now * quantity;
        const fee = price * 0.02;
        const total = price - fee;
        const user = await Schema.findOne({ userid: interaction.user.id });
        if (!user) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.accountnf', {
              prefix: config.bot.prefix
            })
          )
          return interaction.editReply({ embeds: [embed] })
        }
        embed.setDescription(
          client.i18n.t('commands.stock.description.sell', {
            item: results.items[0].name,
            quantity: quantity,
            rnow: comma(result.now * quantity)
          })
        )
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.nowprice'),
          value: client.i18n.t('commands.stock.fields.nowpricev', {
            now: comma(result.now)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.fee'),
          value: client.i18n.t('commands.stock.fields.feev', {
            fee: comma(fee)
          }),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.sum'),
          value: client.i18n.t('commands.stock.fields.sumv', {
            total: comma(total)
          }),
          inline: true
        })
        embed.setImage(
          `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`
        )
        const row = new Discord.ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('stocksell.accept')
              .setLabel(client.i18n.t('commands.stock.button.accept'))
              .setStyle(ButtonStyle.Success)
          )
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('stocksell.deny')
              .setLabel(client.i18n.t('commands.stock.button.cancel'))
              .setStyle(ButtonStyle.Danger)
          )
        const m = await interaction.editReply({
          embeds: [embed],
          components: [row]
        })
        if (!interaction.channel) return
        const collector = interaction.channel.createMessageComponentCollector({
          time: 10000
        })
        // @ts-ignore
        collector.on('collect', async (i) => {
          if (i.user.id != interaction.user.id) return;
          if (i.customId == 'stocksell.accept') {
            embed.setTitle(client.i18n.t('commands.stock.title.success2'))
            embed.setDescription(
              client.i18n.t('commands.stock.description.ssuccess', {
                item: results.items[0].name,
                quantity: quantity
              })
            )
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.nowprice'),
              value: client.i18n.t('commands.stock.fields.nowpricev', {
                now: comma(result.now)
              }),
              inline: true
            })
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.fee'),
              value: client.i18n.t('commands.stock.fields.feev', {
                fee: comma(fee)
              }),
              inline: true
            })
            embed.addFields({
              name: client.i18n.t('commands.stock.fields.sum'),
              value: client.i18n.t('commands.stock.fields.sumv', {
                total: comma(total)
              }),
              inline: true
            })
            embed.setImage(
              `https://ssl.pstatic.net/imgfinance/chart/item/area/day/${results.items[0].code}.png`,
            );
            await interaction.editReply({ embeds: [embed] });
            await Schema.findOneAndUpdate(
              {
                userid: interaction.user.id,
              },
              {
                $inc: { money: +total },
              },
            );
            await StockSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              { $pull: { stocks: { code: stock.stocks[0].code } } },
            );
            await StockSchema.updateOne(
              { userid: interaction.user.id },
              {
                $push: {
                  stocks: {
                    code: results.items[0].code,
                    quantity: stock.stocks[0].quantity - quantity,
                    name: results.items[0].name,
                    price: stock.stocks[0].price,
                  },
                },
              },
            );
            const successEmbed = new Embed(client, 'success')
              .setTitle(client.i18n.t('commands.stock.title.success2'))
              .setDescription(
                client.i18n.t('commands.stock.description.ssuccess', {
                  item: results.items[0].name,
                  quantity: quantity
                })
              )
              .addFields({
                name: client.i18n.t('commands.stock.fields.tamount2'),
                value: client.i18n.t('commands.stock.fields.tamount2v', {
                  total: comma(total)
                }),
                inline: true
              })
              .addFields({
                name: client.i18n.t('commands.stock.fields.fee'),
                value: client.i18n.t('commands.stock.fields.feev', {
                  fee: comma(fee)
                }),
                inline: true
              })
              .addFields({
                name: client.i18n.t('commands.stock.fields.balance'),
                value: client.i18n.t('commands.stock.fields.balancev', {
                  minus: comma(user.money + total)
                }),
                inline: true
              })
              .setColor('#2f3136')
            return i.update({ embeds: [successEmbed], components: [] })
          } else if (i.customId == 'stocksell.deny') {
            embed.setTitle(client.i18n.t('commands.stock.title.cancel2'))
            embed.setDescription(
              client.i18n.t('commands.stock.description.scancel')
            )
            return i.update({ embeds: [embed], components: [] })
          }
        });
        collector.on('end', (collected) => {
          if (collected.size == 1) return;
          interaction.editReply({
            embeds: [embed],
            components: [
              new Discord.ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new Discord.ButtonBuilder()
                    .setCustomId('stock.accept')
                    .setLabel(client.i18n.t('commands.stock.button.accept'))
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                )
                .addComponents(
                  new Discord.ButtonBuilder()
                    .setCustomId('stock.deny')
                    .setLabel(client.i18n.t('commands.stock.button.cancel'))
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
                )
            ]
          })
        })
      }
      if (type === '보유' || type === 'have') {
        const nowStock = await StockSchema.findOne({
          userid: interaction.user.id
        })
        if (!nowStock) {
          embed.setTitle(client.i18n.t('main.title.error'))
          embed.setDescription(
            client.i18n.t('commands.stock.description.dhave', {
              prefix: config.bot.prefix
            })
          )
          return interaction.editReply({
            embeds: [embed],
          });
        } else {
          embed.setTitle(
            client.i18n.t('commands.stock.title.ahave', {
              author: interaction.user.username
            })
          )

          const results = await Promise.all(
            nowStock.stocks.map(async (stock, index) => {
              const stockSearch = await searchStock(stock.code);
              if (!stockSearch)
                return client.i18n.t('commands.stock.message.message', {
                  i: index + 1,
                  name: stock.name,
                  quantity: stock.quantity,
                  sum: comma(Math.round(stock.price * stock.quantity))
                })
              return client.i18n.t('commands.stock.message.message2', {
                i: index + 1,
                name: stock.name,
                quantity: stock.quantity,
                sum: comma(Math.round(stock.price * stock.quantity)),
                first:
                  Math.round(stockSearch.now) > Math.round(stock.price)
                    ? '-'
                    : Math.round(stockSearch.now) < Math.round(stock.price)
                      ? '+'
                      : ' ',
                second:
                  Math.round(stockSearch.now * stock.quantity) >
                    Math.round(stock.price * stock.quantity)
                    ? '▾'
                    : Math.round(stockSearch.now * stock.quantity) <
                      Math.round(stock.price * stock.quantity)
                      ? '▴'
                      : '-'
              })
            })
          )
          embed.setDescription('```diff\n' + results.join('\n') + '```')
          return interaction.editReply({
            embeds: [embed],
          });
        }
      }
      if (type === '도움말') {
        embed.setTitle(client.i18n.t('commands.stock.title.stockhelp'))
        embed.setDescription(client.i18n.t('commands.stock.description.help'))
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.helplist', {
            prefix: config.bot.prefix
          }),
          value: client.i18n.t('commands.stock.fields.helplistv'),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.helpsearch', {
            prefix: config.bot.prefix
          }),
          value: client.i18n.t('commands.stock.fields.helpsearchv'),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.helpbuy', {
            prefix: config.bot.prefix
          }),
          value: client.i18n.t('commands.stock.fields.helpbuyv'),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.helpsell', {
            prefix: config.bot.prefix
          }),
          value: client.i18n.t('commands.stock.fields.helpsellv'),
          inline: true
        })
        embed.addFields({
          name: client.i18n.t('commands.stock.fields.helphave', {
            prefix: config.bot.prefix
          }),
          value: client.i18n.t('commands.stock.fields.helphavev'),
          inline: true
        })
        return interaction.editReply({
          embeds: [embed],
        });
      }
    },
  },
);
