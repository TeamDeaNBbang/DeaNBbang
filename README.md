# 대N

학교 친구들과 공동구매할 사람을 모집하고 참여하는 서비스입니다.

## 기술과 현재 상태

- 프론트: HTML, CSS, JavaScript
- 백엔드: Node.js 24, Express
- DB: SQLite
- 인증: 이메일 인증 후 회원가입, 세션 로그인·로그아웃

현재 메인 화면과 서버 상태 확인 API가 있습니다.
글쓰기·상세 페이지는 개발 중이며 해당 링크는 아직 동작하지 않습니다.

회원가입에서 실제 인증 메일을 받으려면 `backend/.env.example`을 참고해
`backend/.env`에 SMTP 서버 주소·포트·발신 주소와, 필요한 경우 발신 계정 정보를 설정하세요.
메일 설정이 없으면 인증 요청은 실패 응답을 반환합니다.
로그인 세션은 개발용 메모리에 저장되므로 서버를 재시작하면 사라집니다.

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
