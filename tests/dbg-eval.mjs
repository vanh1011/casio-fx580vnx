// Vi phan ln thuc su + duong phim that.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const file = process.argv[2];
const html = readFileSync(file, 'utf8');
const a = html.indexOf('class MathEngine {');
const b = html.indexOf('class CasioDisplay {', a + 1);
const ctx = vm.createContext({ console, window: {}, document: {}, localStorage: {} });
vm.runInContext(html.slice(a, b) + '\nglobalThis.E = MathEngine;', ctx);
const E = ctx.E;
for (const c of ['ln(2)+log(100)', 'ln(e)', 'log(e)+ln(10)', 'ln(e)+ln(e)', 'ln(2)', 'log(1000)']) {
  let out;
  try { out = new E().evaluate(c); } catch (e) { out = 'THROW: ' + e.message; }
  console.log(JSON.stringify(c).padEnd(20), '=>', typeof out === 'number' ? out.toFixed(9) : String(out));
}
