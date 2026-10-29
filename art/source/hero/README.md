# 주인공(토끼) 원본 이미지

이 폴더에 주인공 캐릭터 원본을 올린다. 게임에서 쓰는 스프라이트는 여기서 잘라 `src/assets/`에 만든다.

## 올리는 법
GitHub에서 이 폴더 → **Add file → Upload files** → 파일 끌어다 놓기 → **Commit changes**

## 파일 이름
게임은 파일 이름 속 **방향 단어**로 그림을 찾는다. 그 단어만 들어 있으면 나머지 이름은 자유. 같은 방향을 바꾸려면 새 파일을 올리고 예전 파일은 지운다.

| 방향 | 멈춤 PNG (`bunny-…`) | 이동 GIF |
|---|---|---|
| 아래 | `front` | `south` |
| 오른쪽 아래 | `front-right` | `south-east` |
| 오른쪽 | `right` | `east` |
| 오른쪽 위 | `back-right` | `north-east` |
| 위 | `back` | `north` |
| 왼쪽 위 | `back-left` | `north-west` |
| 왼쪽 | `left` | `west` |
| 왼쪽 아래 | `front-left` | `south-west` |

GIF는 게임에서 원본의 2배 속도로 재생한다 (`src/battle/sprites.ts`의 `HERO_ANIM_SPEED`).

## 있으면 좋은 것
- 배경이 투명하거나 한 가지 단색
- 프레임마다 캐릭터 크기·위치가 일정
- 바라보는 방향이 한쪽으로 통일 (반대쪽은 게임에서 뒤집어 쓴다)
