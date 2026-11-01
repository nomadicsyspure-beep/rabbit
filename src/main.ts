import './ui/style.css';
import { Game } from './game';
import { watchForUpdates } from './core/update';

const game = new Game(document.getElementById('root')!);
// 콘솔에서 상태를 확인하거나 테스트할 때 쓴다
(window as unknown as { rabbit: Game }).rabbit = game;
// 새 버전이 배포되면 알아서 다시 불러온다
watchForUpdates(game);
