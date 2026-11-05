import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const between = (start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  assert.ok(a !== -1 && b !== -1, `Không tìm thấy mã ${start}`);
  return html.slice(a, b);
};
const context = vm.createContext({ console, window: {}, document: {}, localStorage: {} });
vm.runInContext(between('class MathEngine {', 'class CasioDisplay {') + '\n' +
  between('class CasioDisplay {', 'window.casioDisplay = new CasioDisplay();') + '\n' +
  between('class CasioApp {', 'function initCasioWithParams()') + '\n' +
  'globalThis.TestEngine = MathEngine; globalThis.TestDisplay = CasioDisplay; globalThis.TestApp = CasioApp;', context);
const { TestEngine: MathEngine, TestDisplay: CasioDisplay, TestApp: CasioApp } = context;

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
  app.vectorState = { activeVct: 'VctA', dim: 3,
    vectors: { VctA: null, VctB: null, VctC: null, VctD: null }, vctAns: null,
    expression: '', optionPage: 0, optionFrom: 'VCT_CALC', selectAction: 'define', cellIdx: 0, buffer: '' };
  app.statFreq = false;
  app.stat = { type: 'VAR', rows: [{ x: null, y: null, f: null }], r: 0, c: 0,
    buffer: '', msg: '', typeScroll: 0, resLines: [], resScroll: 0 };
  app.menuPage = 1;
  app.menuSelected = 1;
  app.display = {
    language: 'VI', showView() {}, renderExpression() {}, setMode() {}, setResult(result) { this.result = result; },
    updateIndicators(state) { this.stoVisible = state.sto; }, renderList(title, items) { this.title = title; this.items = items; },
    renderCustom(markup) { this.markup = markup; }, formatToNaturalHtml(text) { return text; }, setScrollArrows() {}, updateScrollArrows() {},
    renderMenu(selected, page) { this.selected = selected; this.page = page; }
  };
  return app;
}
function press(app, ...keys) { keys.forEach(key => app.handleKey(key)); }
function approx(actual, expected, tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Mong đợi ${expected}, nhận ${actual}`);
}
function vector(app, name, dim, values) {
  app.vectorState.activeVct = name;
  app.osState = 'VCT_DIM';
  press(app, String(dim));
  assert.equal(app.osState, 'VCT_INPUT');
  for (const value of values) { press(app, ...String(value).split(''), 'EQUALS'); }
  assert.deepEqual(Array.from(app.vectorState.vectors[name]), values);
  press(app, 'AC');
}

test('cùng mã nguồn ở bản web và bản HTML offline', () => {
  assert.equal(html, readFileSync(resolve(root, 'Casio_fx-580VN_X.html'), 'utf8'));
});

test('đạo hàm số tại một điểm: d(x²)/dx tại x=3', () => {
  approx(new MathEngine().evaluate('\\diff{x^2}{3}'), 6, 1e-3);
});

test('tích phân xác định: x² từ 0 tới 2', () => {
  approx(new MathEngine().evaluate('\\int{0}{2}{x^2}'), 8 / 3, 1e-3);
});

test('tích phân đổi cận đổi dấu', () => {
  approx(new MathEngine().evaluate('\\int{2}{0}{x^2}'), -8 / 3, 1e-3);
});

test('mẫu tích phân nhập từ thân; mũi tên chuyển đến hai cận', () => {
  const app = calculator();
  app.insertIntegral();
  assert.equal(app.expression, '\\int{}{}{}');
  assert.equal(app.cursorPos, '\\int{}{}{'.length);
  app.navigateVertical('UP');
  assert.notEqual(app.cursorPos, '\\int{}{}{'.length);
});

test('SOLVE chấp nhận dấu bằng trống bên phải', () => {
  const engine = new MathEngine();
  for (const expr of ['x^2-4=', 'x^2=4']) {
    const answer = engine.solveEquation(expr, 1.5);
    assert.ok(answer && Number.isFinite(answer.x), `${expr}: không tìm được nghiệm`);
    approx(Math.abs(answer.x), 2, 1e-4);
  }
});

test('CALC tính biểu thức có biến qua màn nhập giá trị x', () => {
  const app = calculator();
  app.expression = '2x+1';
  app.cursorPos = app.expression.length;
  press(app, 'CALC');
  assert.equal(app.osState, 'CALC_PROMPT');
  press(app, '3', 'EQUALS');
  approx(app.rawResult, 7);
  assert.equal(app.engine.variables.x, 3);
  assert.equal(app.justCalculated, true);
  assert.equal(app.displayResult, '7');
  assert.equal(app.display.result, '7');
});

test('CALC hỏi từng biến, giữ nguyên biểu thức để tính lại', () => {
  const app = calculator();
  app.expression = 'A+x+M';
  app.cursorPos = app.expression.length;
  press(app, 'CALC');
  assert.match(app.display.markup, /A =/);
  press(app, '2', 'EQUALS');
  assert.match(app.display.markup, /x =/);
  press(app, '3', 'EQUALS');
  assert.match(app.display.markup, /M =/);
  press(app, '4', 'EQUALS');
  approx(app.rawResult, 9);
  assert.equal(app.expression, 'A+x+M');
});

test('Rad: sin nghịch đảo 1/2 hiện pi/6 và vẫn lưu giá trị rad', () => {
  const app = calculator();
  app.engine.setAngleMode('RAD');
  app.state.angleMode = 'RAD';
  press(app, 'SHIFT', 'sin', '0', '.', '5', 'EQUALS');
  assert.equal(app.displayResult, '\\frac{π}{6}');
  approx(app.rawResult, Math.PI / 6);
});

test('phép toán chứa π rút gọn chính xác: π/3 + π/6 = π/2', () => {
  const app = calculator();
  app.expression = '\\frac{π}{3}+\\frac{π}{6}';
  app.cursorPos = app.expression.length;
  press(app, 'EQUALS');
  assert.equal(app.displayResult, '\\frac{π}{2}');
  approx(app.rawResult, Math.PI / 2);
});

test('kết quả phân số π được render theo dạng phân số dọc', () => {
  const display = Object.create(CasioDisplay.prototype);
  display.formatToNaturalHtml = text => text;
  const htmlResult = display.formatResultHtml('\\frac{π}{6}');
  assert.match(htmlResult, /casio-frac/);
  assert.match(htmlResult, /frac-num/);
  assert.match(htmlResult, /frac-den/);
  assert.doesNotMatch(htmlResult, /π÷6/);
});

test('SOLVE tìm điểm đạo hàm x²−4x bằng 0', () => {
  const app = calculator();
  app.expression = '\\diff{x^2-4x}{x}=0';
  app.cursorPos = app.expression.length;
  press(app, 'SHIFT', 'CALC');
  assert.equal(app.osState, 'SOLVE_PROMPT');
  press(app, 'EQUALS');
  assert.equal(app.osState, 'SOLVE_RESULT');
  approx(app.solveState.sol.x, 2, 1e-3);
});

test('ln( e ) và ln(2) bằng log tự nhiên, không trả Math ERROR', () => {
  const app = calculator();
  press(app, 'ln', '2', 'EQUALS');
  approx(app.rawResult, Math.log(2));
  const engine = new MathEngine();
  approx(engine.evaluate('ln(e)'), 1);
});

test('Σ điều hướng từ biểu thức tới cận trên, dưới, không gọi lịch sử', () => {
  const app = calculator();
  app.history = [{expr: '1+1', res: '2'}];
  app.historyIndex = 1;
  app.insertSum();
  const sum = () => app.parseTemplates(app.expression).find(t => t.type === 'sum');
  press(app, 'UP');
  assert.equal(app.cursorPos, sum().upper.start);
  press(app, 'UP');
  assert.equal(app.cursorPos, sum().upper.start);
  assert.equal(app.historyIndex, 1);
  press(app, 'DOWN');
  assert.equal(app.cursorPos, sum().lower.start);
  press(app, 'DOWN');
  assert.equal(app.cursorPos, sum().lower.start);
  assert.equal(app.historyIndex, 1);
});

test('STO lưu biểu thức và kết quả vào A, x, z, M', () => {
  const app = calculator();
  for (const [target, name] of [['neg', 'A'], ['open_paren', 'x'], ['SD', 'z'], ['M_plus', 'M']]) {
    app.expression = '7+5';
    app.cursorPos = app.expression.length;
    app.justCalculated = false;
    press(app, 'STO', target);
    assert.equal(app.engine.variables[name], 12);
  }
  assert.equal(app.state.hasMemory, true);
  app.rawResult = 42;
  app.justCalculated = true;
  press(app, 'STO', 'sin');
  assert.equal(app.engine.variables.D, 42);
});

test('STO bật chữ báo chờ chọn biến và tắt khi hủy hoặc đã lưu', () => {
  const app = calculator();
  app.expression = '12';
  press(app, 'STO');
  assert.equal(app.display.stoVisible, true);
  press(app, 'STO');
  assert.equal(app.display.stoVisible, false);
  press(app, 'STO', 'neg');
  assert.equal(app.display.stoVisible, false);
  assert.equal(app.engine.variables.A, 12);
});

test('ENG đổi 0.003 sang 3×10⁻³ và về dạng thập phân, không đổi giá trị lưu', () => {
  const app = calculator();
  app.expression = '3/1000';
  app.cursorPos = app.expression.length;
  press(app, 'EQUALS', 'ENG');
  assert.equal(app.display.result, '3×10^(-3)');
  approx(app.rawResult, 0.003);
  press(app, 'ENG');
  assert.equal(app.display.result, '0.003');
  press(app, 'ENG', 'STO', 'neg');
  assert.equal(app.display.result, '0.003 → A');
  approx(app.engine.variables.A, 0.003);
});

test('ENG không dùng kết quả cũ trước khi bấm bằng và đặt lại khi tính phép mới', () => {
  const app = calculator();
  app.rawResult = 0.003;
  app.expression = '2';
  press(app, 'ENG');
  assert.equal(app.display.result, undefined);
  press(app, 'EQUALS', 'ENG');
  assert.equal(app.display.result, '2');
  app.expression = '3/1000';
  press(app, 'EQUALS', 'ENG');
  assert.equal(app.display.result, '3×10^(-3)');
});

test('STO không lưu nếu biểu thức không hợp lệ', () => {
  const app = calculator();
  app.expression = '0/0';
  press(app, 'STO', 'neg');
  assert.equal(app.engine.variables.A, 0);
  assert.equal(app.display.result, 'Math ERROR');
});

test('Vector: màn kích thước hiển thị phím 2/3, phím 1 không hợp lệ', () => {
  const app = calculator();
  app.vectorState.activeVct = 'VctA';
  app.osState = 'VCT_DIM';
  app.renderVectorDim();
  assert.match(app.display.items.join(' '), /2: 2 chiều/);
  assert.match(app.display.items.join(' '), /3: 3 chiều/);
  press(app, '1');
  assert.equal(app.osState, 'VCT_DIM');
  press(app, '3');
  assert.equal(app.vectorState.vectors.VctA.length, 3);
});

test('Vector: khai báo 2D và 3D, tích vô hướng và độ dài', () => {
  const app = calculator();
  vector(app, 'VctA', 2, [3, 4]);
  vector(app, 'VctB', 2, [2, -1]);
  assert.equal(app.evaluateVectorExpression('VctA•VctB'), 2);
  assert.equal(app.evaluateVectorExpression('Abs(VctA)'), 5);
  vector(app, 'VctC', 3, [1, 2, 3]);
  assert.deepEqual(Array.from(app.vectorState.vectors.VctC), [1, 2, 3]);
});

test('Vector: tổng, nhân vô hướng, góc, vector đơn vị và tích có hướng', () => {
  const app = calculator();
  app.vectorState.vectors.VctA = [3, 0, 0];
  app.vectorState.vectors.VctB = [0, 4, 0];
  assert.deepEqual(Array.from(app.evaluateVectorExpression('VctA+VctB')), [3, 4, 0]);
  assert.deepEqual(Array.from(app.evaluateVectorExpression('2×VctA')), [6, 0, 0]);
  assert.deepEqual(Array.from(app.evaluateVectorExpression('VctA×VctB')), [0, 0, 12]);
  approx(app.evaluateVectorExpression('Angle(VctA,VctB)'), 90);
  assert.deepEqual(Array.from(app.evaluateVectorExpression('UnitV(VctA)')), [1, 0, 0]);
});

test('Vector: OPTN chèn toán hạng và trả VctAns', () => {
  const app = calculator();
  app.vectorState.vectors.VctA = [1, 2];
  app.vectorState.vectors.VctB = [3, 4];
  app.renderVectorCalc();
  press(app, 'optn', '3', 'add', 'optn', '4', 'EQUALS');
  assert.deepEqual(Array.from(app.vectorState.vctAns ?? []), [4, 6]);
  press(app, 'AC', 'optn', 'DOWN', '1', 'EQUALS');
  assert.deepEqual(Array.from(app.vectorState.vctAns ?? []), [4, 6]);
});

test('Vector: từ chối trộn chiều và vector không khi chuẩn hoá', () => {
  const app = calculator();
  app.vectorState.vectors.VctA = [1, 2];
  app.vectorState.vectors.VctB = [1, 2, 3];
  assert.throws(() => app.evaluateVectorExpression('VctA+VctB'));
  app.vectorState.vectors.VctA = [0, 0];
  assert.throws(() => app.evaluateVectorExpression('UnitV(VctA)'));
});

test('MENU điều hướng bằng mũi tên từ 9 đến A, B, C rồi chọn A', () => {
  const app = calculator();
  app.osState = 'MENU';
  app.menuPage = 2;
  app.menuSelected = 9;
  press(app, 'RIGHT');
  assert.equal(app.menuSelected, 10);
  assert.equal(app.display.page, 2);
  press(app, 'RIGHT', 'RIGHT');
  assert.equal(app.menuSelected, 12);
  press(app, 'RIGHT');
  assert.equal(app.menuSelected, 1);
  assert.equal(app.display.page, 1);
  press(app, 'LEFT');
  assert.equal(app.menuSelected, 12);
  press(app, 'LEFT', 'LEFT');
  assert.equal(app.menuSelected, 10);
});

test('thống kê ghép nhóm: chọn mục 9 sau khi cuộn menu và nhập tần số bằng phím', () => {
  const app = calculator();
  app.startStat();
  for (let i = 0; i < 5; i++) press(app, 'DOWN');
  assert.match(app.display.items.join(' '), /9:Ghép nhóm/);
  press(app, '9');
  assert.equal(app.osState, 'STAT_INPUT');
  press(app, '0', 'EQUALS', '1', '0', 'EQUALS', '2', 'EQUALS', 'AC');
  assert.equal(app.osState, 'STAT_RESULT');
  assert.match(app.stat.resLines.join(' '), /n = 2/);
});

test('thống kê ghép nhóm: trung bình, phương sai, phân vị và mốt xấp xỉ', () => {
  const app = calculator();
  app.stat.type = 'GROUP';
  app.resetStatData();
  assert.deepEqual(Array.from(app.statKeys()), ['lo', 'hi', 'f']);
  app.osState = 'STAT_INPUT';
  press(app, '0', 'EQUALS', '1', '0', 'EQUALS', '2', 'EQUALS');
  press(app, '1', '0', 'EQUALS', '2', '0', 'EQUALS', '4', 'EQUALS');
  press(app, '2', '0', 'EQUALS', '3', '0', 'EQUALS', '2', 'EQUALS');
  app.showStatResult();
  assert.equal(app.osState, 'STAT_RESULT');
  const result = app.engine.calcGroupedStat(app.stat.rows);
  assert.equal(result.n, 8);
  approx(result.mean, 15);
  approx(result.sigma, Math.sqrt(50));
  approx(result.median, 15);
  approx(result.q1, 10);
  approx(result.q3, 20);
  approx(result.mode, 15);
  assert.match(app.stat.resLines.join(' '), /x̄ ≈ 15/);
});

test('thống kê ghép nhóm từ chối thiếu cận, chồng lớp và tần số không hợp lệ', () => {
  const engine = new MathEngine();
  for (const data of [
    [{lo: 0, hi: null, f: 2}],
    [{lo: 5, hi: 5, f: 2}],
    [{lo: 0, hi: 10, f: 2}, {lo: 9, hi: 20, f: 3}],
    [{lo: 0, hi: 10, f: 1.5}]
  ]) assert.equal(engine.calcGroupedStat(data).err, 'Math ERROR');
});

test('OPTN thông thường có mục Hyperbolic, đơn vị góc, ký hiệu kỹ thuật', () => {
  const app = calculator();
  app.openOptionMenu();
  assert.equal(app.osState, 'OPTN');
  assert.match(app.display.items.join(' '), /Hyperbol/i);
  assert.match(app.display.items.join(' '), /Đơn vị góc/i);
  assert.match(app.display.items.join(' '), /Ký hiệu kỹ thuật/i);
});
