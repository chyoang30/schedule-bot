import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  getSchedule,
  saveSchedule,
  deleteSchedule,
  getGuildSchedules,
} from '../utils/store.js';
import { recommendSlots, generateId, progressBar, formatDate } from '../utils/scheduler.js';

// ─────────────────────────────────────────────
//  임베드 빌더 헬퍼
// ─────────────────────────────────────────────

function buildScheduleEmbed(schedule) {
  const totalVoters = Object.keys(schedule.availability).length;
  const recommended = recommendSlots(
    schedule.availability,
    schedule.slots,
    schedule.minParticipants
  );

  const slotsField = schedule.slots
    .map((slot, i) => {
      const entry = schedule.availability;
      const voters = Object.values(entry).filter(v => v.includes(i));
      const bar = progressBar(voters.length, Math.max(totalVoters, 1));
      return `\`${String(i + 1).padStart(2, '0')}\` ${bar} **${voters.length}명** — ${slot}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${schedule.title}`)
    .setColor(schedule.confirmed ? 0x57f287 : 0x5865f2)
    .addFields(
      { name: '📊 투표 현황', value: slotsField || '아직 투표 없음', inline: false },
      {
        name: '👥 참가자',
        value:
          Object.keys(schedule.availability).length > 0
            ? Object.keys(schedule.availability)
                .map(id => `<@${id}>`)
                .join(' ')
            : '없음',
        inline: true,
      },
      {
        name: '⏰ 마감',
        value: formatDate(schedule.deadline),
        inline: true,
      },
      {
        name: '🔢 최소 인원',
        value: `${schedule.minParticipants}명`,
        inline: true,
      }
    )
    .setFooter({ text: `ID: ${schedule.id}` })
    .setTimestamp();

  if (schedule.confirmed) {
    embed.addFields({
      name: '✅ 확정된 일정',
      value: `**${schedule.slots[schedule.confirmedSlot]}**`,
      inline: false,
    });
  } else if (recommended.length > 0) {
    embed.addFields({
      name: '🏆 추천 시간 (상위 3개)',
      value: recommended
        .slice(0, 3)
        .map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.label} — ${r.count}명 가능`)
        .join('\n'),
      inline: false,
    });
  }

  return embed;
}

function buildVoteSelectMenu(schedule) {
  return new StringSelectMenuBuilder()
    .setCustomId(`vote_${schedule.id}`)
    .setPlaceholder('가능한 시간을 모두 선택하세요')
    .setMinValues(1)
    .setMaxValues(schedule.slots.length)
    .addOptions(
      schedule.slots.map((slot, i) => ({
        label: slot,
        value: String(i),
        description: `후보 ${i + 1}`,
      }))
    );
}

function buildActionButtons(scheduleId, isCreator = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote_btn_${scheduleId}`)
      .setLabel('투표하기')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🗳️'),
    new ButtonBuilder()
      .setCustomId(`refresh_${scheduleId}`)
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );

  if (isCreator) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_${scheduleId}`)
        .setLabel('일정 확정')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`cancel_${scheduleId}`)
        .setLabel('취소')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );
  }

  return row;
}

// ─────────────────────────────────────────────
//  메인 핸들러
// ─────────────────────────────────────────────

export async function handleScheduleSubcommand(interaction, sub) {
  if (sub === 'list') {
    const schedules = getGuildSchedules(interaction.guildId).filter(s => !s.confirmed);

    if (schedules.length === 0) {
      return interaction.reply({
        content: '📭 진행 중인 일정 조율이 없습니다. `/schedule create` 로 만들어보세요!',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 진행 중인 일정 조율')
      .setColor(0x5865f2)
      .setDescription(
        schedules
          .map(s => {
            const voters = Object.keys(s.availability).length;
            return `• **${s.title}** — 투표 ${voters}명 | 마감: ${formatDate(s.deadline)} | ID: \`${s.id}\``;
          })
          .join('\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'result') {
    const id = interaction.options.getString('id');
    const schedule = getSchedule(id);

    if (!schedule || schedule.guildId !== interaction.guildId) {
      return interaction.reply({ content: '❌ 해당 일정을 찾을 수 없습니다.', ephemeral: true });
    }

    const embed = buildScheduleEmbed(schedule);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'confirm') {
    const id = interaction.options.getString('id');
    const schedule = getSchedule(id);

    if (!schedule || schedule.guildId !== interaction.guildId) {
      return interaction.reply({ content: '❌ 해당 일정을 찾을 수 없습니다.', ephemeral: true });
    }
    if (schedule.creatorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ 일정을 만든 사람만 확정할 수 있습니다.', ephemeral: true });
    }

    const recommended = recommendSlots(schedule.availability, schedule.slots, 1);
    if (recommended.length === 0) {
      return interaction.reply({ content: '❌ 투표 데이터가 없습니다.', ephemeral: true });
    }

    schedule.confirmed = true;
    schedule.confirmedSlot = recommended[0].slotIndex;
    saveSchedule(schedule);

    const embed = buildScheduleEmbed(schedule);
    embed.setDescription(`🎉 **일정이 확정되었습니다!**\n${recommended[0].label}에 **${recommended[0].count}명**이 참여 가능합니다.`);

    // 참가자들에게 DM 리마인더 예약 알림
    const participants = recommended[0].users;
    interaction.channel.send({
      content: participants.map(id => `<@${id}>`).join(' ') + `\n✅ **일정 확정!** 📅 **${schedule.title}**\n🕐 ${recommended[0].label}`,
      embeds: [embed],
    });

    return interaction.reply({ content: '✅ 일정이 확정되었습니다!', ephemeral: true });
  }

  if (sub === 'cancel') {
    const id = interaction.options.getString('id');
    const schedule = getSchedule(id);

    if (!schedule || schedule.guildId !== interaction.guildId) {
      return interaction.reply({ content: '❌ 해당 일정을 찾을 수 없습니다.', ephemeral: true });
    }
    if (schedule.creatorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ 일정을 만든 사람만 취소할 수 있습니다.', ephemeral: true });
    }

    deleteSchedule(id);
    return interaction.reply({ content: `🗑️ **${schedule.title}** 일정 조율이 취소되었습니다.` });
  }
}

// ─────────────────────────────────────────────
//  이벤트 핸들러 export
// ─────────────────────────────────────────────

export const name = 'interactionCreate';

export async function execute(interaction) {

  // ── 슬래시 커맨드 ──
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ 오류가 발생했습니다.', ephemeral: true };
      interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
    }
    return;
  }

  // ── 모달 제출 (일정 생성) ──
  if (interaction.isModalSubmit() && interaction.customId === 'schedule_create_modal') {
    const title = interaction.fields.getTextInputValue('schedule_title');
    const slotsRaw = interaction.fields.getTextInputValue('schedule_slots');
    const deadlineHours = parseInt(interaction.fields.getTextInputValue('schedule_deadline')) || 24;
    const minParticipants = parseInt(interaction.fields.getTextInputValue('schedule_min') || '2') || 2;

    const slots = slotsRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (slots.length < 2) {
      return interaction.reply({ content: '❌ 후보 시간을 최소 2개 이상 입력해주세요.', ephemeral: true });
    }

    const schedule = {
      id: generateId(),
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      creatorId: interaction.user.id,
      title,
      slots,
      availability: {},
      minParticipants,
      deadline: new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString(),
      confirmed: false,
      confirmedSlot: null,
      createdAt: new Date().toISOString(),
    };

    saveSchedule(schedule);

    const embed = buildScheduleEmbed(schedule);
    const selectRow = new ActionRowBuilder().addComponents(buildVoteSelectMenu(schedule));
    const buttonRow = buildActionButtons(schedule.id, true);

    await interaction.reply({
      content: `📅 **${title}** 일정 조율을 시작합니다!\n아래 메뉴에서 가능한 시간을 모두 선택해주세요.`,
      embeds: [embed],
      components: [selectRow, buttonRow],
    });
    return;
  }

  // ── 셀렉트 메뉴 (투표) ──
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vote_')) {
    const scheduleId = interaction.customId.replace('vote_', '');
    const schedule = getSchedule(scheduleId);

    if (!schedule) {
      return interaction.reply({ content: '❌ 일정을 찾을 수 없습니다.', ephemeral: true });
    }
    if (schedule.confirmed) {
      return interaction.reply({ content: '✅ 이미 확정된 일정입니다.', ephemeral: true });
    }
    if (new Date() > new Date(schedule.deadline)) {
      return interaction.reply({ content: '⏰ 투표 마감 시간이 지났습니다.', ephemeral: true });
    }

    const selectedIndices = interaction.values.map(Number);
    schedule.availability[interaction.user.id] = selectedIndices;
    saveSchedule(schedule);

    const selectedLabels = selectedIndices.map(i => schedule.slots[i]).join(', ');
    await interaction.reply({
      content: `✅ <@${interaction.user.id}> 투표 완료!\n선택한 시간: **${selectedLabels}**`,
      ephemeral: true,
    });

    // 원본 메시지 임베드 업데이트
    const embed = buildScheduleEmbed(schedule);
    const selectRow = new ActionRowBuilder().addComponents(buildVoteSelectMenu(schedule));
    const buttonRow = buildActionButtons(schedule.id, schedule.creatorId === interaction.user.id);
    await interaction.message.edit({ embeds: [embed], components: [selectRow, buttonRow] });
    return;
  }

  // ── 버튼 핸들러 ──
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // 투표 버튼 → 셀렉트 메뉴를 ephemeral로 표시
    if (customId.startsWith('vote_btn_')) {
      const scheduleId = customId.replace('vote_btn_', '');
      const schedule = getSchedule(scheduleId);
      if (!schedule) return interaction.reply({ content: '❌ 일정 없음', ephemeral: true });

      const selectRow = new ActionRowBuilder().addComponents(buildVoteSelectMenu(schedule));
      return interaction.reply({
        content: '가능한 시간을 **모두** 선택해주세요 (복수 선택 가능):',
        components: [selectRow],
        ephemeral: true,
      });
    }

    // 새로고침
    if (customId.startsWith('refresh_')) {
      const scheduleId = customId.replace('refresh_', '');
      const schedule = getSchedule(scheduleId);
      if (!schedule) return interaction.reply({ content: '❌ 일정 없음', ephemeral: true });

      const embed = buildScheduleEmbed(schedule);
      const selectRow = new ActionRowBuilder().addComponents(buildVoteSelectMenu(schedule));
      const buttonRow = buildActionButtons(schedule.id, schedule.creatorId === interaction.user.id);
      await interaction.message.edit({ embeds: [embed], components: [selectRow, buttonRow] });
      return interaction.reply({ content: '🔄 새로고침 완료!', ephemeral: true });
    }

    // 확정 버튼
    if (customId.startsWith('confirm_')) {
      const scheduleId = customId.replace('confirm_', '');
      const schedule = getSchedule(scheduleId);
      if (!schedule) return interaction.reply({ content: '❌ 일정 없음', ephemeral: true });
      if (schedule.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ 일정을 만든 사람만 확정할 수 있습니다.', ephemeral: true });
      }

      const recommended = recommendSlots(schedule.availability, schedule.slots, 1);
      if (recommended.length === 0) {
        return interaction.reply({ content: '❌ 아직 투표 데이터가 없습니다.', ephemeral: true });
      }

      schedule.confirmed = true;
      schedule.confirmedSlot = recommended[0].slotIndex;
      saveSchedule(schedule);

      const participants = recommended[0].users;
      const embed = buildScheduleEmbed(schedule);
      await interaction.message.edit({ embeds: [embed], components: [] });
      await interaction.reply({
        content:
          participants.map(id => `<@${id}>`).join(' ') +
          `\n🎉 **일정 확정!** **${schedule.title}**\n📅 **${recommended[0].label}** — ${recommended[0].count}명 참여`,
      });
      return;
    }

    // 취소 버튼
    if (customId.startsWith('cancel_')) {
      const scheduleId = customId.replace('cancel_', '');
      const schedule = getSchedule(scheduleId);
      if (!schedule) return interaction.reply({ content: '❌ 일정 없음', ephemeral: true });
      if (schedule.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ 일정을 만든 사람만 취소할 수 있습니다.', ephemeral: true });
      }

      deleteSchedule(scheduleId);
      await interaction.message.edit({ components: [] });
      return interaction.reply({ content: `🗑️ **${schedule.title}** 일정 조율이 취소되었습니다.` });
    }
  }
}
