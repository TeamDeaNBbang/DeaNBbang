# 협업 방법

Node.js 24를 사용합니다. IntelliJ에서는 저장소 루트 폴더를 엽니다.

## 실행

터미널에서 backend로 이동한 뒤 실행합니다.

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

.env 복사는 최초 한 번만 합니다. localhost:3000은 메인 화면,
/api/health는 서버 상태를 반환합니다. 종료는 Ctrl+C입니다.

## 브랜치

- main: 팀에서 확인한 배포 기준 코드
- Develop: 기능을 합치고 확인하는 브랜치
- Front: 기존 프론트 작업 브랜치
- feat/auth-signup, feat/auth-session 등: 기능별 작업 브랜치

새 작업은 최신 Develop에서 분기합니다. 기능 브랜치를 push하고
Develop을 대상으로 Pull Request를 만들어 친구의 확인을 받습니다.
Front의 변경도 Pull Request로 Develop에 합칩니다.
브랜치 이름은 대소문자를 구별합니다. 이 흐름은 팀 합의용 제안입니다.

node_modules, .idea, .env는 올리지 않습니다. package-lock.json은 올립니다.
친구는 변경을 받은 뒤 backend에서 npm.cmd ci를 실행합니다.

## 인증 개발 순서

1. SQLite 사용. 가입·로그인 요청 필드와 테이블 생성 규칙 확정
2. 사용자 테이블: 이메일·아이디·학번 중복 제약, 비밀번호 해시, 권한
3. 이메일 인증 발송·확인과 만료 처리
4. 회원가입: 인증 기록 소비와 사용자 생성을 트랜잭션으로 처리
5. express-session과 세션 저장소 설정, 로그인 시 세션 ID 재발급
6. 로그인 검사, 로그아웃 시 세션 삭제와 쿠키 제거
7. 프론트 연결과 실패 상황 확인
8. 관리자 권한 검사, 신고 조회·글 삭제 담당 코드 연동

현재 초기 설정에는 실제 인증과 DB 연결은 구현되어 있지 않습니다.
관리자 권한은 회원가입 요청으로 지정할 수 없게 합니다.
