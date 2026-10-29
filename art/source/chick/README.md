# 병아리(주인공) 원본 이미지

이 폴더에 주인공 병아리 원본 GIF를 올린다. 게임은 여기서 바로 읽지 않고, `tools/chick_frames.py`가 배경 찌꺼기(회색 얼룩)를 지워 `src/assets/chick`에 만든 PNG를 쓴다.

## 폴더
| 폴더 | 동작 | 언제 |
|---|---|---|
| `walking/` | 걷기 | 기본 이동 (방치 화면 포함). 멈춰 있을 땐 첫 프레임 |
| `running/` | 달리기 | 이동 속도가 붙었을 때 (신속 스킬 Lv2부터). 기준은 `src/battle/renderer.ts`의 `RUN_SPEED` |

## 올리는 법
GitHub에서 해당 폴더 → **Add file → Upload files** → 파일 끌어다 놓기 → **Commit changes**.
올린 뒤에는 PNG를 다시 만들어야 게임에 반영된다 (`python3 tools/chick_frames.py`).

## 파일 이름
파일 이름 속 **방향 단어**로 방향을 찾는다. 같은 방향을 바꾸려면 새 파일을 올리고 예전 파일은 지운다.

`south`(아래) · `south-east` · `east`(오른쪽) · `north-east` · `north`(위) · `north-west` · `west`(왼쪽) · `south-west`

## 있으면 좋은 것
- 256×256, 프레임마다 캐릭터 크기·위치가 일정
- 프레임 시간 200ms (게임에서 걷기 2배, 달리기 3배 속도로 재생 → `src/battle/sprites.ts`의 `HERO_ANIM_SPEED`)
