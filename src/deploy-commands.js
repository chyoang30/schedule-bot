import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as scheduleData } from './commands/schedule.js';

const commands = [scheduleData.toJSON()];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 슬래시 커맨드 등록 중...');

    // GUILD_ID가 있으면 특정 서버에만 등록 (즉시 반영, 개발용)
    // 없으면 전체 글로벌 등록 (최대 1시간 소요)
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    const data = await rest.put(route, { body: commands });
    console.log(`✅ ${data.length}개 커맨드 등록 완료!`);
  } catch (err) {
    console.error('❌ 등록 실패:', err);
  }
})();
