// src/data/skills.ts에서 스킬 id와 형태를 뽑아 JSON으로 (tools/skill_bench.cjs 입력)
const fs = require('fs');
const path = require('path');

const s = fs.readFileSync(path.join(__dirname, '../src/data/skills.ts'), 'utf8');
const ids = [...s.matchAll(/\n {4}id: '([a-z]+)', type: '([a-z]+)'/g)].map((m) => ({ id: m[1], type: m[2] }));
console.log(JSON.stringify(ids));
