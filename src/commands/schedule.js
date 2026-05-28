import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('스터디/모임 일정을 조율합니다')
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('새 일정 조율을 시작합니다')
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('현재 진행 중인 일정 조율 목록을 봅니다')
  )
  .addSubcommand(sub =>
    sub
      .setName('result')
      .setDescription('일정 조율 결과를 확인합니다')
      .addStringOption(opt =>
        opt.setName('id').setDescription('일정 ID').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('confirm')
      .setDescription('최적 시간으로 일정을 확정합니다')
      .addStringOption(opt =>
        opt.setName('id').setDescription('일정 ID').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('cancel')
      .setDescription('일정 조율을 취소합니다')
      .addStringOption(opt =>
        opt.setName('id').setDescription('일정 ID').setRequired(true)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    // 모달로 일정 정보 입력받기
    const modal = new ModalBuilder()
      .setCustomId('schedule_create_modal')
      .setTitle('새 일정 조율 만들기');

    const titleInput = new TextInputBuilder()
      .setCustomId('schedule_title')
      .setLabel('모임 이름')
      .setPlaceholder('예: 알고리즘 스터디 5주차')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const slotsInput = new TextInputBuilder()
      .setCustomId('schedule_slots')
      .setLabel('후보 시간 (줄바꿈으로 구분, 최대 10개)')
      .setPlaceholder('월요일 저녁 8시\n수요일 저녁 9시\n토요일 오후 3시')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const deadlineInput = new TextInputBuilder()
      .setCustomId('schedule_deadline')
      .setLabel('투표 마감 (시간 단위, 예: 24)')
      .setPlaceholder('24')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3);

    const minInput = new TextInputBuilder()
      .setCustomId('schedule_min')
      .setLabel('최소 참가 인원')
      .setPlaceholder('2')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(slotsInput),
      new ActionRowBuilder().addComponents(deadlineInput),
      new ActionRowBuilder().addComponents(minInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // list / result / confirm / cancel 은 핸들러에서 처리
  const { handleScheduleSubcommand } = await import('../events/interactionCreate.js');
  await handleScheduleSubcommand(interaction, sub);
}
