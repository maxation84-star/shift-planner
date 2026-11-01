# 근무표 플래너(shift-planner) 인수인계 요약

다른 작업 세션(예: 모자이크 앱)에서 이 앱을 합치거나 연동할 때 필요한 정보입니다.

## 1. 무엇인가
- 숙박업소 직원 10명의 **휴무·연차 근무표 + 객실(다락·첨벙·모닥·노지) 입실 현황** 웹앱.
- 폰 홈 화면에 설치되는 PWA. 로그인(이름 + 4자리 비밀번호) 후 사용.
- 직원은 보기 전용 + 휴무 교환 제안/수락, 관리자(매니저·대표)는 편집.

## 2. 코드 위치
- GitHub: `https://github.com/maxation84-star/shift-planner` (공개 저장소, 기본 브랜치 `main`)
- 배포 주소: `https://maxation84-star.github.io/shift-planner/` (GitHub Pages, `gh-pages` 브랜치로 자동 발행)
- 파일 구성(저장소 루트):
  - `index.html` — **앱 전체가 이 한 파일**(약 1,500줄). HTML + CSS + 바닐라 JS, 프레임워크·빌드 도구 없음, 외부 라이브러리 없음(폰트만 Google Fonts).
  - `sw.js` — 서비스워커(오프라인 캐시, 배포마다 캐시 이름 갱신)
  - `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png` — 홈 화면 설치용
  - `share.json` — 공유 저장소(Firebase) 주소. 앱이 켜질 때 읽어 자동 연결
  - `seed.json` — 서버가 비었을 때 넣는 초기 데이터
  - `version.json` — 배포 시 커밋 해시로 덮어씀(자동 업데이트 확인용)
  - `.github/workflows/pages.yml` — main 푸시 → `__BUILD__` 자리에 커밋 해시 스탬프 → gh-pages 발행
  - `.github/workflows/apply-days.yml`, `apply-auth.yml`, `seed-db.yml`, `dump-db.yml` — 서버 데이터 일괄 수정/확인용(각각 `days-update.json`, `auth-update.json`, `seed.json` 변경 시 실행)
  - `docs/TEAM.md` — 근무 인원·직책, `README.md` — 사용 설명
- (참고) `maxation84-star/shorts-factory` 저장소의 `claude/shift-schedule-app-web-iowpgz` 브랜치 `shift-scheduler/` 폴더에 초기 버전 사본이 있으나 **오래됨**. 최신은 shift-planner 저장소.

## 3. 서버/데이터
- **Firebase Realtime Database**(무료 Spark)를 SDK 없이 REST로 사용.
  - 주소: `share.json`의 `db` 값 (`https://working-3207b-default-rtdb.asia-southeast1.firebasedatabase.app/boards/<보드id>`)
  - 읽기: `GET <db>.json`, 실시간: `EventSource(<db>.json)`(SSE `put`/`patch` 이벤트), 쓰기: `PUT <db>.json`(상태 전체 교체)
  - 규칙: `boards/$board`에 `.read: true, .write: true` (링크를 아는 사람은 누구나 읽고 쓸 수 있음 → 비밀번호는 UI 수준 보호)
- 기기에도 항상 `localStorage`(`shiftplan.v1`)에 저장, 최근 40개 자동 백업(`shiftplan.hist`).
- 저장 충돌 방지: 수정 후 0.5초 디바운스 저장, 저장 대기 중(`dirty`)에는 서버 내용을 적용하지 않음.

### 데이터 구조(JSON 한 덩어리)
```json
{
  "version": 1,
  "people":   [{"id":"p1","name":"허나경","color":"#f9b5cc","work":"w6","baseOff":4,"annual":1}],
  "rooms":    [{"id":"r1","name":"다락","color":"#f6c1d9"}],
  "bookings": [{"id":"..","room":"r1","start":"2026-11-02","nights":2,"kind":"stay","label":""}],
  "days":     {"2026-11-06":{"off":{"p1":"off","p5":"annual"},"tags":[],"memo":""}},
  "requests": [{"id":"..","pid":"p5","from":"2026-11-06","to":"2026-11-16","note":"","status":"pending","t":1792559398735}],
  "swaps":    [{"id":"..","a":"p1","aDate":"2026-11-06","b":"p2","bDate":"2026-11-09","note":"","status":"pending","t":0}],
  "auth":     {"pins":{"p1":"<sha256>"},"admin":"<sha256>","admins":["p1","p2"],"guest":"<sha256>"},
  "settings": {"weekend":"satsun"}
}
```
- `work`: `w6`(주6일, 월 휴무 4) / `w5`(주5일, 월 휴무 8). `off` 값: `off`(휴무) · `annual`(연차) · `extra`(추가휴무).
- `bookings.kind`: `stay`(입실; nights≥2면 연박 표시) / `work`(공사). 숙박일 칸에만 띠 표시.
- 사람 id는 `p1`~`p10` 고정(허나경 p1, 홍기범 p2, 김경숙 p3, 김규선 p4, 전희원 p5, 서수정 p6, 김정민 p7, 박태선 p8, 용태중 p9, 김은정 p10). 객실 r1 다락, r2 첨벙, r3 모닥, r4 노지.

## 4. 로그인/권한
- 비밀번호는 4자리, 서버에는 SHA-256 해시만: `sha256("shiftplan:<pid>:<pin>")`, 담당자 `sha256("shiftplan:admin:<pin>")`, 손님 `sha256("shiftplan:guest:<pin>")`.
- 모드
  - **보기 모드**(기본): 로그인 전에는 달력 숨김. 직원 로그인 → 달력 + 휴무 교환. 손님 로그인 → 달력만. 객실 정보 숨김.
  - **편집 모드**: `#edit` 주소 + 담당자 비밀번호, 또는 `auth.admins`에 든 직원(매니저)이 로그인. 휴무 입력·드래그·객실·자동 배정·요청/교환 처리·직원 관리.
- 기기 저장 키: `shiftplan.me`(pid), `shiftplan.meTok`, `shiftplan.admTok`, `shiftplan.guestTok`, `shiftplan.wantEdit`.

## 5. 주요 기능
- 월간 달력(일~토, 일 빨강·토 파랑 배경), 폰은 **주간 보기** 기본(좌우 스와이프).
- 휴무/연차/추가 입력, 이름 끌어다 옮기기, 빠른 입력(이름 선택 후 날짜 탭).
- 객실 띠: 연박 빨강·입실 흰색·공실 빈칸·공사 주황 빗금(관리자만).
- 집계: 직원별 휴무 n/기본, 연차, 평일/주말 횟수(주말 기준 토·일/금·토 설정), 합계.
- 자동 배정(고르게, 하루 최대 인원, 금·토 피하기), 달력 이미지(PNG) 공유, 글 복사, 백업/복원.
- 변경 요청(관리자 승인), 직원끼리 휴무 교환(상대 수락), 자동 업데이트(새 버전 자동 새로고침).

## 6. 코드 구조(index.html 안 주요 함수)
- 상태: `state`, `normalize()`(모든 입력 검증/보정), `defaultState()`, `SEED`/`applySeed()`
- 저장: `scheduleSave()`→`cloudSave()`→`fbSave()`/`binSave()`, 원격 수신 `initFirebase()`→`applyRemote()`, 보기 모드 쓰기 `remoteMutate(fn)`
- 렌더: `render()`→`renderTitle/renderQuick/renderCal/renderWeek/renderSide/renderReqBtn/renderSwapBtn/renderMeBtn`
- 날짜 상세: `openDay()`(편집) / `openDayView()`(보기), 객실 상태 `laneState(roomId, dateKey)`
- 인증: `pinHash()`, `openLogin()`, `openAdminGate()`, `evalMode()`(모드 결정), `checkGate()`(로그인 전 잠금), `isAdminUser()`, `isGuest()`
- 기능: `autoAssign()`, `renderCalendarImage()`, `openSwap()`, `openRequests()`, `openPeople()`(직원·객실 관리), `checkUpdate()`
- CSS: `:root` 토큰(항상 화이트 테마), `body.view-mode`(직원용), `body.locked`(로그인 전)

## 7. 다른 앱과 합치거나 연동하는 방법
1. **그대로 끼워 넣기**: 웹뷰/iframe으로 `https://maxation84-star.github.io/shift-planner/` 표시. 가장 쉬움.
2. **데이터만 공유**: 다른 앱이 같은 Firebase 주소를 `GET <db>.json`으로 읽으면 "오늘 누가 휴무/근무인지"를 바로 알 수 있음(`days[오늘].off`에 없는 사람이 근무자). 로그인도 같은 해시 방식이면 비밀번호를 공유 가능.
3. **코드 합치기**: `index.html`이 단일 파일이라 CSS/JS 블록을 옮겨 탭 하나로 붙일 수 있음. 전역 충돌 없이 IIFE 안에 있음.

## 8. 알아둘 제약
- 서버 규칙이 공개 쓰기라 보안은 "실수 방지" 수준. 손님 이름·연락처 같은 민감정보는 넣지 않음.
- Firebase 테스트 모드로 시작했으면 30일 뒤 규칙 만료 → 위 규칙으로 바꿔야 함.
- GitHub Actions 토큰으로는 저장소 생성·Pages 설정 변경이 안 됨(사람이 해야 함).
