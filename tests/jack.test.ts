import { describe, expect, it } from 'vitest'
import { compileProgram, parse, tokenize, tokensXml } from '../src/jack/jack'
import { Vm } from '../src/vm/vm'
import { OS, osText } from '../src/vm/os'

const MAIN = `
/** Тестовая программа: массив, объекты, строки, циклы, рекурсия. */
class Main {
  static int total;
  function void main() {
    var Array a; var int i; var Point p, q; var String s;
    let a = Array.new(5);
    let i = 0;
    while (i < 5) { let a[i] = i * i; let i = i + 1; }
    let total = Main.sum(a, 5);
    let p = Point.new(3, -4);
    let q = Point.new(1, 2);
    do p.add(q);
    do Output.printInt(total);
    do Output.printString(" ok ");
    do Output.printInt(p.getX() + p.getY());
    do Output.printInt(Main.fact(6));
    if (~(total = 30)) { do Output.printString("BAD"); } else { do Output.printString("!"); }
    return;
  }
  function int sum(Array a, int n) { var int i, s; let s = 0; let i = 0; while (i < n) { let s = s + a[i]; let i = i + 1; } return s; }
  function int fact(int n) { if (n < 2) { return 1; } return n * Main.fact(n - 1); }
}`
const POINT = `class Point {
  field int x, y;
  constructor Point new(int ax, int ay) { let x = ax; let y = ay; return this; }
  method void add(Point o) { let x = x + o.getX(); let y = y + o.getY(); return; }
  method int getX() { return x; }
  method int getY() { return y; }
}`

describe('Компилятор Jack и ВМ', () => {
  it('токены и XML', () => {
    const t = tokenize('let x = "a<b"; // comment\nif (x > 1) {}')
    expect(t.map((x) => x.type).slice(0, 5)).toEqual(['keyword', 'identifier', 'symbol', 'stringConstant', 'symbol'])
    expect(tokensXml(t)).toContain('<stringConstant> a&lt;b </stringConstant>')
    expect(tokensXml(t)).toContain('<symbol> &gt; </symbol>')
    const { xml } = parse('class A { function void f() { return; } }', 'A')
    expect(xml.split('\n')[0]).toBe('<class>')
    expect(xml).toContain('  <subroutineDec>')
    expect(xml).toContain('    <parameterList>\n    </parameterList>')
  })
  it('скомпилированная программа выполняется правильно', () => {
    const vm = new Vm(compileProgram({ Main: MAIN, Point: POINT }), OS)
    vm.boot()
    expect(vm.run()).toBe(true)
    expect(vm.out.join('')).toBe('30 ok 2720!')
    expect(osText(vm).split('\n')[0].trimEnd()).toBe('30 ok 2720!')
  })
  it('понятные ошибки', () => {
    expect(() => compileProgram({ Main: 'class Main { function void main() { let x = 1; return; } }' })).toThrow(/не объявлена/)
    expect(() => compileProgram({ Main: 'class Main { function void main() { let = 1; } }' })).toThrow(/строка 1/)
  })
})
