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
  between('class CasioApp {', 'function initCasioWithParams()') + '\n' +
  'globalThis.TestEngine = MathEngine; globalThis.TestApp = CasioApp;', context);
const { TestEngine: MathEngine, TestApp: CasioApp } = context;

function calculator() {
  const app = Object.create(CasioApp.prototype);
  app.engine = new MathEngine();
  app.state = { shift: false, alpha: false, sto: false, hasMemory: false, angleMode: 'DEG', currentMode: 1, modeName: 'COMP' };
  app.osState = 'NORMAL';
  app.expression = '';
  app.cursorPos = 0;
  app.justCalculated = false;
  app.rawResult = 0;
  app.vectorState = { activeVct: 'VctA', dim: 3,
    vectors: { VctA: null, VctB: null, VctC: null, VctD: null }, vctAns: null,
    expression: '', optionPage: 0, optionFrom: 'VCT_CALC', selectAction: 'define', cellIdx: 0, buffer: '' };
  app.display = {
    language: 'VI', showView() {}, renderExpression() {}, setResult(result) { this.result = result; },
    updateIndicators() {}, setScrollArrows() {}, renderList(title, items) { this.title = title; this.items = items; },
    renderCustom(markup) { this.markup = markup; }
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
  press(app, dim === 2 ? '1' : '2');
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

test('STO không lưu nếu biểu thức không hợp lệ', () => {
  const app = calculator();
  app.expression = '0/0';
  press(app, 'STO', 'neg');
  assert.equal(app.engine.variables.A, 0);
  assert.equal(app.display.result, 'Math ERROR');
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

test('OPTN thông thường có mục Hyperbolic, đơn vị góc, ký hiệu kỹ thuật', () => {
  const app = calculator();
  app.openOptionMenu();
  assert.equal(app.osState, 'OPTN');
  assert.match(app.display.items.join(' '), /Hyperbol/i);
  assert.match(app.display.items.join(' '), /Đơn vị góc/i);
  assert.match(app.display.items.join(' '), /Ký hiệu kỹ thuật/i);
});
