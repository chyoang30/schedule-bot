/**
 * 참가자들의 가능 시간 슬롯을 분석해서 최적 시간대를 추천합니다.
 * @param {Object} availability - { userId: [slotIndex, ...], ... }
 * @param {string[]} slots - 전체 시간 슬롯 배열
 * @param {number} minParticipants - 최소 참가자 수
 * @returns {Array} 추천 슬롯 목록 (참가자 수 내림차순)
 */
export function recommendSlots(availability, slots, minParticipants = 2) {
  // 슬롯별 가능한 참가자 집계
  const slotCount = new Map();

  for (const [userId, userSlots] of Object.entries(availability)) {
    for (const slotIdx of userSlots) {
      if (!slotCount.has(slotIdx)) {
        slotCount.set(slotIdx, { count: 0, users: [] });
      }
      slotCount.get(slotIdx).count++;
      slotCount.get(slotIdx).users.push(userId);
    }
  }

  // 최소 참가자 이상인 슬롯만 필터링 후 내림차순 정렬
  const results = [...slotCount.entries()]
    .filter(([, v]) => v.count >= minParticipants)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5) // 상위 5개
    .map(([idx, v]) => ({
      slotIndex: idx,
      label: slots[idx],
      count: v.count,
      users: v.users,
    }));

  return results;
}

/**
 * 날짜 문자열을 KST 기준 가독성 좋게 포맷
 */
export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
}

/**
 * 고유 ID 생성 (8자리 hex)
 */
export function generateId() {
  return Math.random().toString(16).slice(2, 10);
}

/**
 * 진행 바 생성 (투표 현황 시각화)
 */
export function progressBar(value, max, length = 10) {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
