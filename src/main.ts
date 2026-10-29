import './ui/style.css';
import { Game } from './game';

const game = new Game(document.getElementById('root')!);
// 콘솔에서 상태를 확인하거나 테스트할 때 쓴다
(window as unknown as { rabbit: Game }).rabbit = game;
