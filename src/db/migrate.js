import pool from './pool.js';

const SQL = `
-- 일정 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id            VARCHAR(8)   PRIMARY KEY,
  guild_id      VARCHAR(20)  NOT NULL,
  channel_id    VARCHAR(20)  NOT NULL,
  creator_id    VARCHAR(20)  NOT NULL,
  title         VARCHAR(50)  NOT NULL,
  slots         JSONB        NOT NULL DEFAULT '[]',
  min_participants INT       NOT NULL DEFAULT 2,
  deadline      TIMESTAMPTZ  NOT NULL,
  confirmed     BOOLEAN      NOT NULL DEFAULT FALSE,
  confirmed_slot INT,
  warned_deadline   BOOLEAN  NOT NULL DEFAULT FALSE,
  closed_announced  BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 투표 테이블 (availability)
CREATE TABLE IF NOT EXISTS votes (
  schedule_id   VARCHAR(8)   NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id       VARCHAR(20)  NOT NULL,
  slot_indices  INT[]        NOT NULL DEFAULT '{}',
  voted_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, user_id)
);

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_schedules_guild ON schedules(guild_id);
CREATE INDEX IF NOT EXISTS idx_votes_schedule  ON votes(schedule_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('✅ 마이그레이션 완료');
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
