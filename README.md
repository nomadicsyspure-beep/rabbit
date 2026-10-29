# rabbit

방치형(탭타이탄류) + 뱀서라이크를 합친 모바일 웹 게임 프로토타입.
평소엔 토끼가 자동사냥으로 성장하고, 보스 스테이지와 던전에서는 직접 조작해서 싸운다.

## 실행

```bash
npm install
npm run dev
```

`npm run dev`는 같은 와이파이의 폰에서도 접속할 수 있게 `--host`로 띄운다. 터미널에 나오는 `Network:` 주소를 폰에서 열면 된다.

```bash
npm run build
```

`main` 브랜치에 푸시하면 GitHub Actions가 GitHub Pages로 배포한다. 처음 한 번은 저장소 Settings → Pages → Source를 **GitHub Actions**로 바꿔야 한다.

## 구조

```
src/
  battle/      공용 전투 엔진 (두 모드가 같이 씀)
    engine.ts       적·투사체·충돌·피해 처리
    controllers.ts  AutoController(방치) / Joystick(액션)
    weapons.ts      무기 4종
    renderer.ts     임시 도형 렌더러 (스프라이트로 바꿀 땐 이 파일만 교체)
  modes/
    idle.ts      방치 모드: 스테이지 진행, 골드, 탭 공격
    action.ts    액션 모드: 웨이브, 레벨업 카드, 보스
  data/
    balance.ts   방치 수치 공식과 액션 배율 (밸런스는 여기서 조정)
    skills.ts    레벨업 카드 스킬 정의
  core/          저장, 숫자 표기
  ui/            DOM UI (HUD, 패널, 탭, 모달)
  game.ts        모드 전환, 게임 루프, 입력, 오프라인 보상
```

기획과 결정 사항은 [docs/PLAN.md](docs/PLAN.md) 참고.
