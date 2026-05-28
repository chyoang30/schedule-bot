# Schedule Bot

> Discord 기반 스터디/모임 일정 조율 봇

여러 명이 모임 일정을 잡을 때, 카톡이나 디스코드 채팅으로 "언제 되세요?"를 반복하는 번거로움을 해결하기 위해 만든 프로젝트입니다.  
후보 시간대에 대한 투표를 수집하고, 가장 많은 인원이 참여 가능한 시간을 자동으로 추천합니다.

---

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| Runtime | Node.js 20 |
| Discord API | discord.js v14 |
| Web Framework | Express v4 |
| Database | PostgreSQL (pg 드라이버) |
| Scheduler | node-cron |
| 배포 | Fly.io + Docker |

---

## 아키텍처

```
┌─────────────────────────────────────────┐
│              Fly.io Container           │
│                                         │
│  ┌─────────────┐    ┌────────────────┐  │
│  │ Discord Bot │    │  Express API   │  │
│  │ (discord.js)│    │  :3000         │  │
│  └──────┬──────┘    └───────┬────────┘  │
│         │                   │           │
│         └─────────┬─────────┘           │
│                   │                     │
│          ┌────────▼────────┐            │
│          │   Data Layer    │            │
│          │  (store.js)     │            │
│          └────────┬────────┘            │
│                   │                     │
│          ┌────────▼────────┐            │
│          │   PostgreSQL    │            │
│          │  (Fly Postgres) │            │
│          └─────────────────┘            │
└─────────────────────────────────────────┘
```

Discord 봇과 REST API 서버를 단일 프로세스에서 실행합니다. 봇은 Discord WebSocket으로 인터랙션을 처리하고, API 서버는 외부에서 일정 데이터를 조회할 수 있는 엔드포인트를 제공합니다.

---

## 주요 기능

- **가능 시간 투표** — 최대 10개 후보 시간에 대해 복수 선택 투표
- **최적 시간 자동 추천** — 참가자 수 기준 상위 3개 시간대 계산
- **리마인더 알림** — 마감 1시간 전 자동 독촉, 마감 후 결과 공지 (node-cron)
- **REST API** — 일정 조회 / 서버 통계 엔드포인트

---

## REST API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 헬스체크 (DB 연결 확인) |
| GET | `/api/schedules/:guildId` | 서버 일정 목록 |
| GET | `/api/schedule/:id` | 일정 상세 + 투표 현황 + 추천 시간 |
| GET | `/api/stats/:guildId` | 서버 통계 |

---

## DB 설계

```sql
-- 일정 테이블
schedules (
  id VARCHAR(8) PRIMARY KEY,
  guild_id, channel_id, creator_id,
  title, slots JSONB,
  min_participants, deadline,
  confirmed, confirmed_slot,
  ...
)

-- 투표 테이블
votes (
  schedule_id REFERENCES schedules ON DELETE CASCADE,
  user_id,
  slot_indices INT[],
  PRIMARY KEY (schedule_id, user_id)
)
```

slots는 순서가 있는 문자열 배열이라 JSONB로 저장하고, 투표는 별도 테이블로 분리해 참가자별 수정이 용이하도록 설계했습니다.

---

## 트러블슈팅

**async/await 누락으로 인한 상호작용 실패**

store.js를 JSON 파일 기반에서 PostgreSQL 기반으로 전환하면서 모든 데이터 접근 함수가 async로 바뀌었습니다. 그러나 이벤트 핸들러에서 `await` 없이 호출해 항상 `undefined`를 반환하는 문제가 발생했습니다. Discord는 인터랙션에 3초 내 응답이 없으면 "상호작용 실패"를 표시하기 때문에, 에러가 콘솔에 출력되지 않고 사용자에게만 실패로 보였습니다. Fly.io 로그에서 `TypeError: Cannot read properties of undefined` 를 확인하고 모든 호출부에 `await`를 추가해 해결했습니다.

**Git 충돌 마커가 배포 이미지에 포함되는 문제**

로컬에서 브랜치 병합 중 발생한 충돌 마커(`<<<<<<<`)가 해결되지 않은 채 push되어 Docker 빌드는 성공했지만 런타임에 `SyntaxError`로 앱이 반복 재시작되는 문제가 있었습니다. `fly logs`로 에러 위치를 특정하고, `findstr /r /s "<<<<<<" src\*.js`로 충돌 파일을 탐색해 수정했습니다.

---

## 로컬 실행

```bash
npm install
cp .env.example .env  # 환경변수 입력
npm run migrate       # DB 테이블 생성
npm run deploy        # Discord 슬래시 커맨드 등록
npm start
```

---

## 배포 (Fly.io)

```bash
fly launch
fly postgres create --name schedule-bot-db
fly postgres attach schedule-bot-db
fly secrets set DISCORD_TOKEN=xxx CLIENT_ID=xxx API_KEY=xxx
fly deploy
```

`fly.toml`의 `release_command`로 배포 시마다 마이그레이션이 자동 실행됩니다.