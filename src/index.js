import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { data as scheduleData, execute as scheduleExecute } from './commands/schedule.js';
import { execute as interactionHandler } from './events/interactionCreate.js';
import { startReminderCron } from './events/reminder.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 커맨드 등록
client.commands = new Collection();
client.commands.set('schedule', { data: scheduleData, execute: scheduleExecute });

// 준비 이벤트
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} 온라인!`);
  console.log(`📡 ${client.guilds.cache.size}개 서버에서 동작 중`);
  startReminderCron(client);
});

// 인터랙션 이벤트
client.on('interactionCreate', interactionHandler);

// 에러 핸들링
client.on('error', err => console.error('[Discord Error]', err));
process.on('unhandledRejection', err => console.error('[Unhandled Rejection]', err));

client.login(process.env.DISCORD_TOKEN);
