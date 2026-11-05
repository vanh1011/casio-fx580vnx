// Probe ngoài bộ test: bấm phím thật + edge case có nguy cơ hồi quy.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const between = (start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a === -1 || b === -1) throw new Error(`Không tìm thấy ${start}`);
  return html.slice(a, b);
};
const context = vm.createContext({ console, window: {}, document: {}, localStorage: {} });
vm.runInContext(
  between('class MathEngine {', 'class CasioDisplay {') + '\n' +
  between('class CasioApp {', 'function initCasioWithParams()') + '\n' +
  'globalThis.E = MathEngine; globalThis.A = CasioApp;',
  context
);
const { E: MathEngine, A: CasioApp } = context;

function calculator() {
  const app = Object.create(CasioApp.prototype);
  app.engine = new MathEngine();
  app.state = { shift: false, alpha: false, sto: false, hasMemory: false, angleMode: 'DEG', currentMode: 1, modeName: 'COMP' };
  app.osState = 'NORMAL';
  app.expression = '';
  app.cursorPos = 0;
  app.justCalculated = false;
  app.rawResult = 0;
  app.history = [];
  app.historyIndex = -1;
  app.displayResult = '0';
  app.display = {
    renderExpression(expr, pos) { this.expr = expr; this.pos = pos; },
    renderResult(text) { this.result = text; },
    renderError() {}, renderCustom(markup) { this.markup = markup; },
    setScrollArrows() {}, updateScrollArrows() {},
    renderMenu(selected, page) { this.selected = selected; this.page = page; },
    showStoIndicator() {}, hideStoIndicator() {}, setAngleMode() {}, updateCursor() {},
  };
  app.vectorState = {
    activeVct: 'VctA', dim: 3,
    vectors: { VctA: null, VctB: null, VctC: null, VctD: null },
    vctAns: null, expression: '', optionPage: 0, optionFrom: 'VCT_CALC', selectAction: 'define', cellIdx: 0, buffer: '',
  };
  return app;
}
const press = (app, ...keys) => keys.forEach(k => app.handleKey(k));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const near = (a, b, tol = 1e-6) => {
  if (!(typeof a === 'number' && Number.isFinite(a) && Math.abs(a - b) <= tol))
    throw new Error(`kết quả ${JSON.stringify(a)} ≠ ${b}`);
};
const eq = (a, b) => { if (a !== b) throw new Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

console.log('\n[1] CALC qua phím thật');
check('biểu thức 2x+1 dựng bằng phím, CALC hỏi x rồi tính', () => {
  const app = calculator();
  press(app, '2', 'alpha', 'x', 'add', '1');
  eq(app.expression, '2x+1');
  press(app, 'CALC');
  eq(app.osState, 'CALC_PROMPT');
  press(app, '5', 'EQUALS');
  near(app.rawResult, 11);
  near(app.engine.variables.x, 5);
  eq(app.expression, '2x+1');
});
check('CALC lần 2 gợi lại giá trị cũ, đổi số ra kết quả mới', () => {
  const app = calculator();
  app.expression = '2x+1'; app.cursorPos = app.expression.length;
  press(app, 'CALC', '5', 'EQUALS'); near(app.rawResult, 11);
  press(app, 'CALC');
  eq(app.osState, 'CALC_PROMPT');
  press(app, 'EQUALS');           // nhận giá trị đang có (5)
  near(app.rawResult, 11);
});
check('CALC bỏ qua Ans, chỉ hỏi biến thật', () => {
  const app = calculator();
  app.expression = 'Ans+2'; app.cursorPos = app.expression.length;
  press(app, 'CALC');
  eq(app.osState, 'NORMAL');      // không có biến -> tính thẳng
});
check('CALC khi biểu thức rỗng không crash', () => {
  const app = calculator();
  press(app, 'CALC');
  eq(app.osState, 'NORMAL');
});
check('AC thoát màn CALC, giữ biểu thức', () => {
  const app = calculator();
  app.expression = 'x^2'; app.cursorPos = 3;
  press(app, 'CALC');
  press(app, 'AC');
  eq(app.osState, 'NORMAL');
});

console.log('\n[2] Rad: hàm lượng giác ngược ra dạng π');
check('sin⁻¹(1/2) = π/6', () => {
  const app = calculator();
  press(app, 'MODE', '4', '3');   // nếu menu khác sẽ bỏ qua, tự set bên dưới
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'sin', '0', '.', '5', 'EQUALS');
  eq(app.displayResult, 'π/6');
  near(app.rawResult, Math.PI / 6);
});
check('cos⁻¹(1/2) = π/3', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'cos', '0', '.', '5', 'EQUALS'); // 0.5
  eq(app.displayResult, 'π/3');
});
check('tan⁻¹(1) = π/4', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'tan', '1', 'EQUALS');
  eq(app.displayResult, 'π/4');
});
check('sin⁻¹(1) = π/2', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'sin', '1', 'EQUALS');
  eq(app.displayResult, 'π/2');
});
check('sin⁻¹(0) = 0', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'sin', '0', 'EQUALS');
  eq(app.displayResult, '0');
});
check('sin⁻¹(-0.3) giữ dạng thập phân (không phải góc đẹp)', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD'); app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'sin', 'neg', '0', '.', '3', 'EQUALS');
  near(app.rawResult, Math.asin(-0.3));
  eq(app.displayResult, '-0.3046926553');
});
check('DEG: sin⁻¹(1/2) vẫn ra 30, không bị π/6', () => {
  const app = calculator();
  press(app, 'SHIFT', 'sin', '0', '.', '5', 'EQUALS');
  eq(app.displayResult, '30');
});
check('GRA: sin⁻¹(1/2) ra 20', () => {
  const app = calculator();
  app.engine.setAngleMode('GRA'); app.state.angleMode = 'GRA';
  press(app, 'SHIFT', 'sin', '0', '.', '5', 'EQUALS');
  eq(app.displayResult, '20');
});
check('Rad: asin trong biểu thức lớn hơn vẫn đúng số', () => {
  const e = new MathEngine();
  e.setAngleMode('RAD');
  near(e.evaluate('2sin⁻¹(0.5)'), Math.PI / 3);
});

console.log('\n[3] SOLVE với đạo hàm');
check('SOLVE d/dx(x²−4x)=0 ra x=2', () => {
  const app = calculator();
  app.expression = '\\diff{x^2-4x}{x}=0'; app.cursorPos = app.expression.length;
  press(app, 'SHIFT', 'CALC');
  eq(app.osState, 'SOLVE_PROMPT');
  press(app, 'EQUALS');
  eq(app.osState, 'SOLVE_RESULT');
  near(app.solveState.sol.x, 2, 1e-3);
});
check('SOLVE d/dx(x³−3x)=0 ra x=1 (nghiệm dương gần 0)', () => {
  const app = calculator();
  app.expression = '\\diff{x^3-3x}{x}=0'; app.cursorPos = app.expression.length;
  press(app, 'SHIFT', 'CALC');
  press(app, 'EQUALS');
  near(app.solveState.sol.x, 1, 1e-3);
});
check('SOLVE x²−4=0 không bị hồi quy', () => {
  const app = calculator();
  app.expression = 'x^2-4=0'; app.cursorPos = app.expression.length;
  press(app, 'SHIFT', 'CALC');
  press(app, '2', 'EQUALS');
  near(app.solveState.sol.x, 2, 1e-4);
});
check('đạo hàm tự do \\diff{x^2}{3} = 6 (không qua SOLVE)', () => {
  near(new MathEngine().evaluate('\\diff{x^2}{3}'), 6, 1e-3);
});
check('đạo hàm khi x đã có giá trị sẵn vẫn đúng', () => {
  const e = new MathEngine();
  e.variables.x = 100;
  near(e.evaluate('\\diff{x^2}{3}'), 6, 1e-3);
  near(e.variables.x, 100);      // phải khôi biến
});

console.log('\n[4] ln / log');
check('ln(2) qua phím = log tự nhiên', () => {
  const app = calculator();
  press(app, 'ln', '2', 'EQUALS');
  near(app.rawResult, Math.log(2));
});
check('ln(e) = 1', () => near(new MathEngine().evaluate('ln(e)'), 1));
check('log(100) = 2 (log cơ số 10, không bị ln hóa)', () => near(new MathEngine().evaluate('log(100)'), 2));
check('2log(100)+ln(e) = 5 (cả hai cùng biểu thức)', () => near(new MathEngine().evaluate('2log(100)+ln(e)'), 5));
check('ln(100) ≠ log(100)', () => {
  const e = new MathEngine();
  near(e.evaluate('ln(100)'), Math.log(100));
  near(e.evaluate('log(100)'), 2);
});
check('logBASE(2,8) = 3 không bị ảnh hưởng', () => near(new MathEngine().evaluate('\\logbase{2}{8}'), 3));
check('ln(e^2) = 2', () => near(new MathEngine().evaluate('ln(e^2)'), 2, 1e-6));

console.log('\n[5] Σ và điều hướng');
check('Σ dựng bằng phím rồi UP/DOWN vào cận, không chạm lịch sử', () => {
  const app = calculator();
  app.history = [{ expr: '1+1', res: '2' }, { expr: '2+2', res: '4' }];
  app.historyIndex = 2;
  press(app, 'SHIFT', '(');
  if (!app.parseTemplates(app.expression).some(t => t.type === 'sum')) app.insertSum();
  app.cursorPos = app.expression.length;
  const sum = () => app.parseTemplates(app.expression).find(t => t.type === 'sum');
  press(app, 'UP'); eq(app.cursorPos, sum().upper.start);
  press(app, 'DOWN'); eq(app.cursorPos, sum().lower.start);
  eq(app.historyIndex, 2);
});
check('Σ ở xa con trỏ thì UP/DOWN vẫn dùng lịch sử bình thường', () => {
  const app = calculator();
  app.expression = '\\sum{1}{5}{x}+3';
  app.cursorPos = app.expression.length;   // sau "+3"
  app.history = [{ expr: '9*9', res: '81' }];
  app.historyIndex = 1;
  press(app, 'UP');
  if (app.historyIndex === 1) throw new Error('UP không gọi lịch sử dù con trỏ ngoài mẫu Σ');
});
check('Σ tính đúng tổng 1..5 của x²', () => {
  const e = new MathEngine();
  near(e.evaluate('\\sum{1}{5}{x^2}'), 55, 1e-6);
});
check('Σ với biến A (không phải x) vẫn dùng giá trị A hiện có', () => {
  const e = new MathEngine();
  e.variables.A = 2;
  near(e.evaluate('\\sum{1}{3}{Ax}'), 12, 1e-6);   // 2*1+2*2+2*3
});

console.log('\n[6] Hồi quy do đổi regex implicit-multiply / e');
check('1e5 là khoa học 100000, không thành 1×Math.E×5', () => near(new MathEngine().evaluate('1e5'), 100000));
check('2.5e-3 = 0.0025', () => near(new MathEngine().evaluate('2.5e-3'), 0.0025));
check('e một mình = 2.718281828', () => near(new MathEngine().evaluate('e'), Math.E, 1e-9));
check('2e = 2×e', () => near(new MathEngine().evaluate('2e'), 2 * Math.E, 1e-9));
check('sin(30) ở DEG = 0.5 (mẫu \b bị siết)', () => {
  const e = new MathEngine();
  near(e.evaluate('sin(30)'), 0.5);
});
check('2x với x=3 = 6', () => {
  const e = new MathEngine();
  e.variables.x = 3;
  near(e.evaluate('2x'), 6);
});
check('x(x+1) với x=3 = 12', () => {
  const e = new MathEngine();
  e.variables.x = 3;
  near(e.evaluate('x(x+1)'), 12);
});
check('xy với x=2,y=3 = 6', () => {
  const e = new MathEngine();
  e.variables.x = 2; e.variables.y = 3;
  near(e.evaluate('xy'), 6);
});
check('Ans không bị split nhầm thành A+n+s', () => {
  const e = new MathEngine();
  e.variables.Ans = 10;
  near(e.evaluate('Ans+1'), 11);
});
check('PreAns vẫn hoạt động', () => {
  const e = new MathEngine();
  e.variables.PreAns = 7; e.variables.Ans = 3;
  near(e.evaluate('PreAns+Ans'), 10);
});
check('GCD/LCM không bị biến tên phá', () => {
  const e = new MathEngine();
  near(e.evaluate('GCD(12,18)'), 6);
});
check('biến M trong 3M+1 với M=4 = 13', () => {
  const e = new MathEngine();
  e.variables.M = 4;
  near(e.evaluate('3M+1'), 13);
});

console.log(`\n${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
