# rabbit

방치형(탭타이탄류) + 뱀서라이크를 합친 모바일 웹 게임 프로토타입.
스테이지는 직접 조작(뱀서라이크)으로 깨고, 방치 화면에서는 깬 최고 스테이지 기준으로 재화가 쌓인다.

## 실행

```bash
npm install
npm run dev
```

`npm run dev`는 같은 와이파이의 폰에서도 접속할 수 있게 `--host`로 띄운다. 터미널에 나오는 `Network:` 주소를 폰에서 열면 된다.

```bash
npm run build
```

`main`에 푸시하면 GitHub Actions가 빌드해서 결과물을 `gh-pages` 브랜치에 올린다. Pages 설정은 Settings → Pages → Source **Deploy from a branch**, Branch **gh-pages / (root)**.

주소: https://nomadicsyspure-beep.github.io/rabbit/

## 구조

```
src/
  battle/      공용 전투 엔진 (두 모드가 같이 씀)
    engine.ts       적·투사체·충돌·피해 처리
    controllers.ts  AutoController(방치) / Joystick(액션)
    weapons.ts      스킬 13종의 동작 (스킬 트리: 피해·발동 속도·개수)
    renderer.ts     렌더러 (스프라이트, 못 불러오면 도형으로 대신 그림)
    sprites.ts      스프라이트 불러오기
  modes/
    idle.ts      방치 화면 (보여주기용 자동 전투 + 탭 공격)
    action.ts    스테이지 플레이: 웨이브, 장착 스킬 발동, 경험치, 정예/마왕 보스
  data/
    balance.ts   방치 수치 공식과 액션 배율 (밸런스는 여기서 조정)
    skills.ts    스킬 정의 (골드로 배우고 가지별 강화, 8개 장착)
  assets/      chick/ 병아리 프레임, monsters/ fx/ ground/ ui/ 시트에서 잘라낸 그림
  core/          저장, 숫자 표기
  ui/            DOM UI (HUD, 패널, 탭, 모달)
  game.ts        모드 전환, 게임 루프, 입력, 오프라인 보상
```

몬스터·이펙트·UI 그림은 `art/source/fx-sheet.webp`(몬스터·스킬 이펙트)와 `art/source/ui-sheet.webp`(HUD·버튼·패널)에서 잘라낸다. 시트 속 숫자·글자는 지우고 게임이 그 자리에 값을 쓴다. 좌표를 바꾸면 다시 만든다 (Pillow 필요).

```bash
python3 tools/cut_sheets.py
```

주인공(병아리)은 `art/source/chick`의 걷기·달리기 GIF를 배경 찌꺼기를 지운 프레임 띠 PNG(`src/assets/chick`)로 바꿔 쓴다. GIF를 새로 올리면 다시 만든다.

```bash
python3 tools/chick_frames.py
```

기획과 결정 사항은 [docs/PLAN.md](docs/PLAN.md), 다음 성장·BM·콘텐츠 아이디어는 [docs/IDEAS.md](docs/IDEAS.md) 참고.
