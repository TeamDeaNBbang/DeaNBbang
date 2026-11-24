# 관리자 기능 연결

게시글 서버 코드가 아직 없어서 관리자 기능과 통합할 최소 구조를 추가했습니다.
이 문서의 필드는 친구의 글 작성·참가 구현과 맞춰야 합니다.

## 테이블

- writings: id, author_id → users.id, title, content, created_at, deleted_at, deleted_by → users.id
- reports: id, writing_id → writings.id, reporter_id → users.id, reason, created_at
- 시각은 Unix epoch 밀리초 정수입니다.
- reports는 (writing_id, reporter_id)가 유일해서 같은 회원은 같은 글을 한 번 신고합니다.
- 관리자 삭제는 deleted_at과 deleted_by를 채웁니다. 원문과 신고 이력은 DB에 남습니다.
- 관리자는 삭제 시 reason을 1~1,000자로 직접 입력합니다. 사유는 writings.deletion_reason과 알림에 저장됩니다.
- 삭제와 작성자 이메일 알림 예약은 하나의 트랜잭션으로 저장합니다.
- npm start 또는 npm run dev로 실행하면 5초마다 예약된 메일을 처리합니다.
- 메일에는 글 제목·번호·관리자가 입력한 삭제 사유·삭제 시각을 담습니다. SMTP 실패 시 최대 5회 재시도하며 기록은 deletion_notifications에 남습니다.
- 일반 목록·상세·참가·수정에서는 반드시 deleted_at IS NULL 조건을 사용하세요.
- 실제 author_id와 reporter_id는 요청 본문 대신 로그인 세션의 사용자를 사용하세요.
- 가격·물건·목표 인원 등 글 작성에 필요한 필드는 게시글 담당이 확장합니다.

## API

| 요청 | 성공 | 설명 |
|---|---|---|
| GET /api/auth/me | 200 | 현재 로그인한 id, username, role |
| GET /api/writing | 200 | {writings, nextCursor}, 삭제된 글 제외 |
| GET /api/writing/{writingId} | 200 | 삭제된 글은 404 POST_NOT_FOUND |
| POST /api/writing/accuse/{writingId} | 201 | {reason} 입력. 로그인 필수, 중복은 409 ALREADY_REPORTED |
| GET /api/admin/reports | 200 | {reports, nextCursor}, 삭제되지 않은 신고 글. 관리자 필수 |
| DELETE /api/admin/writing/{writingId} | 204 | {reason} 필수. 관리자 글 삭제. 없거나 이미 삭제되면 404 POST_NOT_FOUND |

목록은 50개씩 반환합니다. nextCursor가 있으면 ?before=nextCursor로 다음 목록을 가져옵니다.
관리자 기능은 미로그인 401 UNAUTHORIZED, 일반 사용자 403 ADMIN_ACCESS_DENIED입니다.
권한은 요청마다 DB에서 조회하므로 권한 회수는 기존 세션에도 즉시 반영됩니다.
관리자 API 경로는 노션에 정의되어 있지 않아 위 경로로 정했습니다.

## 실행 확인

backend에서 npm ci 후 npm run dev로 실행합니다.
회원가입 화면에서 등록한 계정에 아래 명령으로 관리자 권한을 부여할 수 있습니다.

```powershell
npm.cmd run set-admin -- 실제가입한메일주소
```

새 세션 없이 다음 요청부터 적용됩니다. 운영에서는 신뢰할 수 있는 서버 관리자만 이 명령을 실행합니다.
관리자 페이지는 /html/admin.html입니다. DB에 있는 글은 일반 메인 화면에 표시됩니다.
신고 등록은 글 상세의 사유 입력 폼을 사용합니다.

로컬에 게시글이 없으면 아래 명령으로 테스트 글 하나를 만들 수 있습니다.

```powershell
npm.cmd run seed:user
npm.cmd run seed:moderation
```

일반 회원으로 테스트 글 신고 → 일반 회원 관리자 접근 403 → 관리자 신고 조회 →
삭제 → 일반 목록에서 제외·상세 404 순서로 확인합니다.
게시글 생성·수정·참가·사진 업로드 기능은 게시글 담당의 연결이 필요합니다.
