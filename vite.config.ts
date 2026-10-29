import { defineConfig } from 'vite';

// 상대 경로로 빌드해서 GitHub Pages(/rabbit/) 같은 하위 경로에서도 그대로 동작하게 한다.
export default defineConfig({
  base: './',
});
