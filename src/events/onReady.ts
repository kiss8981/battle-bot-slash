import { ChannelType } from 'discord.js'
import Status from '../schemas/statusSchema'
import BotClient from '../structures/BotClient'
import { Event } from '../structures/Event'
import Embed from '../utils/Embed'
import Logger from '../utils/Logger'
import Premium from '../schemas/premiumSchemas'
import schedule from 'node-schedule'
import DateFormatting from '../utils/DateFormatting'
import Automod from '../schemas/autoModSchema'
import { GuildChannel } from 'discord.js'
import NFTUserWallet from '../schemas/NFTUserWalletSchema'
import NFTGuildVerify from '../schemas/NFTGuildVerifySchema'
import axios from 'axios'
import config from '../../config'
import CommandManager from '../managers/CommandManager'
import web from '../server/index'
import PremiumUser from '../schemas/premiumUserSchemas'

const logger = new Logger('bot')

export default new Event(
  'ready',
  async (client) => {
    setInterval(async () => {
      StatusUpdate(client)
    }, 60 * 1000 * 5)
    setInterval(async () => {
      ServerCountUpdate(client)
    }, 60 * 1000 * 10)
    schedule.scheduleJob('0 0 0 * * *', () => {
      PremiumAlert(client)
      automodResetChannel(client)
      nftChecker(client)
      PremiumPersonAlert(client)
    })
    const commandManager = new CommandManager(client)
    await commandManager.slashGlobalCommandSetup()
    logger.info(`Logged ${client.user?.username}`)
  },
  { once: true }
)
async function StatusUpdate(client: BotClient) {
  const totalShard = client.shard?.count
  const shardInfo = await ShardInfo(client)
  const status = new Status()
  status.build_number = client.BUILD_NUMBER!
  ;(status.commands = String(client.commands.size)),
    (status.totalShard = String(totalShard))
  // @ts-ignore
  status.shard = shardInfo
  status.save((err: any) => {
    if (err) logger.error(`봇 상태 업데이트 오류: ${err}`)
  })
  logger.info('봇 상태 업데이트')
}

async function PremiumAlert(client: BotClient) {
  const PremiumDB = await Premium.find({})
  PremiumDB.forEach((guild) => {
    const premiumguild = client.guilds.cache.get(guild.guild_id)
    if (!premiumguild) return
    const user = client.users.cache.get(premiumguild.ownerId)
    if (!user) return
    const embed = new Embed(client, 'info')
    embed.setTitle(`${client.user?.username} 프리미엄`)
    const now = new Date()
    const lastDate = Math.round(
      (Number(guild.nextpay_date) - Number(now)) / 1000 / 60 / 60 / 24
    )
    if (lastDate === 7) {
      embed.setDescription(
        `${
          premiumguild.name
        } 서버의 프리미엄 만료일이 7일 (${DateFormatting._format(
          guild.nextpay_date
        )}) 남았습니다`
      )
      return user.send({ embeds: [embed] })
    }
    if (lastDate === 1) {
      embed.setDescription(
        `${
          premiumguild.name
        } 서버의 프리미엄 만료일이 1일 (${DateFormatting._format(
          guild.nextpay_date
        )}) 남았습니다`
      )
      return user.send({ embeds: [embed] })
    }
    if (lastDate === 0) {
      embed.setDescription(
        `${premiumguild.name} 서버의 프리미엄이 만료되었습니다`
      )
      return user.send({ embeds: [embed] })
    }
  })
}

async function PremiumPersonAlert(client: BotClient) {
  const PremiumDB = await PremiumUser.find({})
  PremiumDB.forEach((user) => {
    const users = client.users.cache.get(user.user_id)
    if (!users) return
    const embed = new Embed(client, 'info')
    embed.setTitle(`${client.user?.username} 프리미엄`)
    const now = new Date()
    const lastDate = Math.round(
      (Number(user.nextpay_date) - Number(now)) / 1000 / 60 / 60 / 24
    )
    try {
      if (lastDate === 7) {
        embed.setDescription(
          `${
            users.username
          }님의 프리미엄 만료일이 7일 (${DateFormatting._format(
            user.nextpay_date
          )}) 남았습니다`
        )
        return users.send({ embeds: [embed] })
      }
      if (lastDate === 1) {
        embed.setDescription(
          `${
            users.username
          } 서버의 프리미엄 만료일이 1일 (${DateFormatting._format(
            user.nextpay_date
          )}) 남았습니다`
        )
        return users.send({ embeds: [embed] })
      }
      if (lastDate === 0) {
        embed.setDescription(
          `${users.username} 서버의 프리미엄이 만료되었습니다`
        )
        return users.send({ embeds: [embed] })
      }
    } catch (e) {
      logger.error(e as unknown as string)
    }
  })
}

async function ShardInfo(client: BotClient) {
  const shardInfo = []
  const totalShard = client.shard?.count as number
  const wsping = (await client.shard?.fetchClientValues('ws.ping')) as number[]
  const guilds = (await client.shard?.fetchClientValues(
    'guilds.cache.size'
  )) as number[]
  const users = (await client.shard?.fetchClientValues(
    'users.cache.size'
  )) as number[]
  const channels = (await client.shard?.fetchClientValues(
    'channels.cache.size'
  )) as number[]
  const uptime = (await client.shard?.fetchClientValues('uptime')) as number[]

  for (let i = 0; i < totalShard; i++) {
    shardInfo.push({
      shardNumber: i,
      shardPing: wsping[i],
      shardGuild: guilds[i],
      shardMember: users[i],
      shardChannels: channels[i],
      shardUptime: uptime[i]
    })
  }
  return shardInfo
}

async function automodResetChannel(client: BotClient) {
  const automod = await Automod.find()
  automod.forEach(async ({ useing, guild_id }) => {
    if (!useing.useResetChannel) return
    if (!useing.useResetChannels || useing.useResetChannels.length === 0) return
    const guild = client.guilds.cache.get(guild_id)
    if (!guild) return
    const newChannels: string[] = []
    for await (const resetchannel of useing.useResetChannels) {
      const channel = guild?.channels.cache.get(resetchannel) as GuildChannel
      if (!channel) return
      const newchannel = await guild?.channels.create({
        name: channel.name,
        type: ChannelType.GuildText,
        parent: channel.parent ? channel.parent.id : undefined,
        permissionOverwrites: channel.permissionOverwrites.cache,
        position: channel.position
      })
      if (!newchannel) return
      await newchannel.send({
        embeds: [
          new Embed(client, 'info')
            .setTitle('채널 초기화')
            .setDescription('채널 초기화가 완료되었습니다.')
        ]
      })
      await channel.delete()
      newChannels.push(newchannel.id)
    }
    return await Automod.updateOne(
      { guild_id: guild_id },
      { $set: { 'useing.useResetChannels': newChannels } }
    )
  })
}

async function nftChecker(client: BotClient) {
  const wallet_list = await NFTUserWallet.find()
  const guild_list = await NFTGuildVerify.find()
  wallet_list.forEach(async (user_wallet) => {
    await axios
      .get(
        `https://th-api.klaytnapi.com/v2/account/${user_wallet.wallet_address}/token?kind=nft`,
        {
          headers: {
            Authorization: 'Basic ' + config.klaytnapikey,
            'X-Chain-ID': '8217'
          }
        }
      )
      .then((data) => {
        guild_list.forEach(async (guild_data) => {
          const result = data.data.items.filter(
            (x: any) => x.contractAddress === guild_data.wallet
          )
          if (result.length === 0) {
            const guild = client.guilds.cache.get(guild_data.guild_id)
            if (!guild) return
            const member = guild.members.cache.get(user_wallet.user_id)
            if (!member) return
            try {
              await member.roles.remove(guild_data.role_id)
            } catch (e) {
              return
            }
          } else {
            return
          }
        })
      })
      .catch((e) => {
        return
      })
  })
}

async function ServerCountUpdate(client: BotClient) {
  const res = await client.shard?.fetchClientValues('guilds.cache.size')
  axios
    .post(
      `https://api.archiver.me/bots/${client.user?.id}/server`,
      {
        servers: res?.reduce((acc, guilds) => Number(acc) + Number(guilds), 0)
      },
      {
        headers: { Authorization: 'Bearer ' + config.updateServer.archive }
      }
    )
    .then((data) => {
      logger.info('아카이브: 서버 수 업데이트 완료')
    })
    .catch((e: any) => {
      logger.error(
        `아카이브: 서버 수 업데이트 오류: ${e.response?.data.message}`
      )
    })

  axios
    .post(
      `https://koreanbots.dev/api/v2/bots/${client.user?.id}/stats`,
      {
        servers: res?.reduce((acc, guilds) => Number(acc) + Number(guilds), 0),
        shards: client.shard?.count
      },
      {
        headers: { Authorization: config.updateServer.koreanbots }
      }
    )
    .then((data) => {
      logger.info('한디리: 서버 수 업데이트 완료')
    })
    .catch((e: any) => {
      logger.error(`한디리: 서버 수 업데이트 오류: ${e.response?.data.message}`)
    })
}
