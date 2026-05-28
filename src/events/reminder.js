import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { getAllSchedules, saveSchedule } from '../utils/store.js';
import { recommendSlots, formatDate } from '../utils/scheduler.js';

/**
 * 1시간마다 실행:
 *  - 마감 1시간 전 투표 독촉 알림
 *  - 마감된 일정 자동 결과 공지
 */
export function startReminderCron(client) {
  cron.schedule('0 * * * *', async () => {
    const now = Date.now();
    const schedules = Object.values(getAllSchedules());

    for (const schedule of schedules) {
      if (schedule.confirmed) continue;

      const deadline = new Date(schedule.deadline).getTime();
      const remaining = deadline - now;

      try {
        const channel = await client.channels.fetch(schedule.channelId).catch(() => null);
        if (!channel) continue;

        // 마감 1시간 전 알림
        if (remaining > 0 && remaining <= 60 * 60 * 1000 && !schedule.warnedDeadline) {
          schedule.warnedDeadline = true;
          saveSchedule(schedule);

          const voterCount = Object.keys(schedule.availability).length;
          await channel.send({
            content: `⏰ **[마감 임박]** **${schedule.title}** 투표 마감까지 1시간 남았습니다!\n현재 투표 인원: **${voterCount}명** | 아직 투표 안 하셨다면 지금 바로!`,
          });
        }

        // 마감 후 자동 결과 공지
        if (remaining <= 0 && !schedule.closedAnnounced) {
          schedule.closedAnnounced = true;
          saveSchedule(schedule);

          const recommended = recommendSlots(
            schedule.availability,
            schedule.slots,
            schedule.minParticipants
          );

          const embed = new EmbedBuilder()
            .setTitle(`⏰ 투표 마감 — ${schedule.title}`)
            .setColor(recommended.length > 0 ? 0xfee75c : 0xed4245)
            .setTimestamp();

          if (recommended.length > 0) {
            embed.setDescription(
              `투표가 마감되었습니다. 아래 추천 시간을 확인하고 \`/schedule confirm\` 으로 확정하세요.`
            );
            embed.addFields({
              name: '🏆 추천 시간',
              value: recommended
                .slice(0, 3)
                .map((r, i) => `${['🥇', '🥈', '🥉'][i]} **${r.label}** — ${r.count}명 가능`)
                .join('\n'),
            });
          } else {
            embed.setDescription('투표 결과 최소 인원을 충족하는 시간대가 없습니다. 다시 조율이 필요합니다.');
          }

          embed.setFooter({ text: `일정 ID: ${schedule.id} | 주최자: <@${schedule.creatorId}>` });

          await channel.send({
            content: `<@${schedule.creatorId}> 투표가 마감되었습니다!`,
            embeds: [embed],
          });
        }
      } catch (err) {
        console.error(`[Reminder] 오류 (${schedule.id}):`, err.message);
      }
    }
  });

  console.log('⏰ 리마인더 크론 시작됨 (1시간 간격)');
}
