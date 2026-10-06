const fs = require('fs');
const { loadGameFromHtml, createGame, compile } = require('./lib/game');
const html = fs.readFileSync(process.argv[2], 'utf8');
const info = loadGameFromHtml(html);
const { A } = createGame(compile(info), info, { viewport: '390x844' }, 1);
const W = A.g('WEAPONS'), T = A.g('TRINKETS'), M = A.g('MUTATIONS'), E = A.g('ENEMY_TYPES');
let bad = 0;
for(const id in W) if(W[id].desc.length > 70){ bad++; console.log('silah', id, W[id].desc.length, W[id].desc); }
for(const t of T) if(t.desc.length > 60){ bad++; console.log('tılsım', t.id, t.desc.length, t.desc); }
for(const m of M) if(m.desc.length > 70){ bad++; console.log('mutasyon', m.id, m.desc.length, m.desc); }
for(const k in E) if(E[k].intro && E[k].intro.length > 40 && !E[k].boss){ bad++; console.log('intro', k, E[k].intro.length, E[k].intro); }
console.log(bad ? bad + ' uzun metin' : 'tüm metinler sınır içinde');
