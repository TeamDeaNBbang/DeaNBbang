# 대N

학교 친구들과 공동구매할 사람을 모집하고 참여하는 서비스입니다.

## 기술과 현재 상태

- 프론트: HTML, CSS, JavaScript
- 백엔드: Node.js 24, Express
- DB: SQLite
- 인증: 이메일 인증 후 회원가입, 세션 로그인·로그아웃

메인·회원가입·로그인·글쓰기·상세·마이페이지와 관리자 신고 조회/삭제 화면이 서버에 연결되어 있습니다.

회원가입에서 실제 인증 메일을 받으려면 `backend/.env.example`을 참고해
`backend/.env`에 SMTP 서버 주소·포트·발신 주소와, 필요한 경우 발신 계정 정보를 설정하세요.
메일 설정이 없으면 인증 요청은 실패 응답을 반환합니다.
개발 환경의 로그인 세션은 메모리에 저장되므로 서버를 재시작하면 사라집니다.
운영 환경에서는 SQLite에 세션을 저장합니다.

## Railway 배포

루트 `Dockerfile`이 프론트와 백엔드를 함께 배포합니다. Node.js 24를 사용하며
`/api/health`가 서버 상태 확인 주소입니다. Railway 서비스는 한 개의 복제본으로 실행합니다.

- 볼륨을 `/data`에 연결합니다. 회원/게시글 DB, 세션 DB, 업로드 사진을 이곳에 저장합니다.
- `NODE_ENV=production`, `DATA_DIR=/data`를 설정합니다.
- `SESSION_SECRET`, `EMAIL_VERIFICATION_SECRET`는 서로 다른 32자 이상의 임의 값으로 설정하고 재배포 때도 유지합니다.
- SMTP 설정은 `.env.example`을 참고해 Railway Variables에 입력합니다. 개인 `.env`와 로컬 DB는 업로드하지 않습니다.
- HTTPS 도메인에서 접속합니다. 운영 세션 쿠키에는 Secure, HttpOnly, SameSite=Lax가 적용됩니다.

Railway Hobby/Free/Trial은 SMTP 연결을 지원하지 않으므로 Gmail SMTP를 그대로 쓸 수 없습니다.
이 환경에서는 이메일 HTTPS API 연동이 필요합니다. 메일 전송이 실패하면 회원가입 인증도 실패하며,
인증을 건너뛰지는 않습니다. [Railway 이메일 발송 안내](https://docs.railway.com/networking/outbound-networking)를 참고하세요.

배포 설정은 `.railway/railway.ts`에서 관리합니다. 루트에서 `npm.cmd ci` 후 Railway CLI로
`railway config plan`을 확인하고 `railway config apply`로 적용합니다. 볼륨 삭제나 분리 변경이
나오면 적용하지 마세요. 이후 루트에서 `railway up`으로 배포합니다.
운영 DB는 새로 생성되며 개발 중 만든 로컬 계정/게시글은 자동으로 복사되지 않습니다.

## 실행하기

저장소를 내려받아 IntelliJ에서 루트 폴더를 엽니다.
PowerShell에서 다음을 실행합니다.

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

`.env` 복사는 최초 한 번만 합니다. 실행 후 http://localhost:3000 에 접속합니다.
이미 3000번 서버가 실행 중이라면 먼저 종료하거나 `.env`의 PORT를 바꿉니다.
검사는 backend에서 `npm.cmd test`로 실행합니다.

## 폴더 구조

- `backend/src`: 서버 코드
- `backend/test`: 서버와 화면 자원 연결 검사
- `frontend/html`, `frontend/css`, `frontend/image`: 화면과 자원
- `.github`: 자동 검사와 PR 양식

## 협업

최신 `Develop`에서 기능 브랜치를 만들고 PR을 통해 합칩니다.
실행 규칙과 개발 순서는 [협업 안내](CONTRIBUTING.md)를 참고하세요.
개인 `.env`와 SQLite DB 파일은 올리지 않고, 테이블 생성 규칙을 공유합니다.

준성·시현 담당: 인증 및 관리자 기능. 현우·민균 담당: 게시글 관련 기능.

## 명세

- [프로젝트 노션](https://app.notion.com/p/N-3f19394648e380c1ac53c71bbf2b61d3)
- [기능 명세서](https://app.notion.com/p/3f19394648e3801fbfefc21665350b62)
- [API 명세서](https://app.notion.com/p/3f99394648e380c4b5f4e6e54a020fc8)
