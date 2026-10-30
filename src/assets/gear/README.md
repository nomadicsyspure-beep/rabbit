# 장비 겉모습 그림

여기에 PNG를 넣으면 게임이 자동으로 병아리에 입힌다 (빌드할 때 읽음). 그림이 없는 장비는 임시 아이콘·모양으로 보인다.

## 모자·등 (방향별 레이어)

1. `art/templates/chick-<방향>.png` (256×256, 걷기 첫 프레임)를 그림 프로그램에서 연다.
2. **새 레이어**를 만들어 그 위에 모자(또는 날개·망토·가방)를 그린다. 병아리 그림은 건드리지 않는다.
3. 병아리 레이어를 끄고, 장비 레이어만 **같은 256×256 크기, 투명 배경 PNG**로 내보낸다.
4. 파일 이름: `<장비id>-<방향>.png` → 이 폴더에 올린다.

방향은 5개: `south`, `south-east`, `east`, `north-east`, `north`
(왼쪽 방향은 오른쪽 그림을 뒤집어 쓴다. 따로 그리고 싶으면 `south-west`, `west`, `north-west`도 넣으면 그게 쓰인다.)

걸을 때 머리가 들썩이는 건 게임이 프레임마다 머리 위치를 찾아서 맞춰 준다.
등 장비는 아래·옆을 볼 땐 몸 뒤에, 위를 볼 땐(`north*`) 몸 앞에 그려진다 — 그래서 `north` 그림엔 등이 보이게, `south` 그림엔 몸 뒤로 삐져나온 부분만 그리면 된다.

## 무기 (옆에 둥둥)

`<장비id>.png` 한 장. 방향 없음, 투명 배경, 대략 정사각형 (게임에서 24px 폭으로 줄여 그린다).

## 장비 id

| 부위 | id |
|---|---|
| 무기 | staff_feather, rod_fire, fan_thunder, wand_star, scythe_dark, sword_demon |
| 모자 | hat_straw, hat_mush, hat_ice, hat_fire, hat_demon |
| 등 | bag_leather, cape_red, wings_bat, wings_angel, cape_demon |

예: `hat_ice-south.png`, `hat_ice-east.png`, … / `wings_angel-north.png` / `wand_star.png`
