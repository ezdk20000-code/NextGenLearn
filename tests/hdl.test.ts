import { describe, expect, it } from 'vitest'
import { BUILDABLE, CHIPS, chipByName, skeleton } from '../src/hdl/chips'
import { compile, HdlError } from '../src/hdl/hdl'
import { runTests } from '../src/hdl/tests'

// Эталонные решения — только чтобы проверить сам движок.
const P: Record<string, string> = {
  Not: 'Nand(a=in, b=in, out=out);',
  And: 'Nand(a=a, b=b, out=n); Not(in=n, out=out);',
  Or: 'Not(in=a, out=na); Not(in=b, out=nb); Nand(a=na, b=nb, out=out);',
  Xor: 'Nand(a=a, b=b, out=n); Nand(a=a, b=n, out=x); Nand(a=b, b=n, out=y); Nand(a=x, b=y, out=out);',
  Mux: 'Not(in=sel, out=ns); And(a=a, b=ns, out=w1); And(a=b, b=sel, out=w2); Or(a=w1, b=w2, out=out);',
  DMux: 'Not(in=sel, out=ns); And(a=in, b=ns, out=a); And(a=in, b=sel, out=b);',
  Not16: Array.from({ length: 16 }, (_, i) => `Not(in=in[${i}], out=out[${i}]);`).join(' '),
  And16: Array.from({ length: 16 }, (_, i) => `And(a=a[${i}], b=b[${i}], out=out[${i}]);`).join(' '),
  Or16: Array.from({ length: 16 }, (_, i) => `Or(a=a[${i}], b=b[${i}], out=out[${i}]);`).join(' '),
  Mux16: Array.from({ length: 16 }, (_, i) => `Mux(a=a[${i}], b=b[${i}], sel=sel, out=out[${i}]);`).join(' '),
  Or8Way: 'Or(a=in[0], b=in[1], out=o1); Or(a=o1, b=in[2], out=o2); Or(a=o2, b=in[3], out=o3); Or(a=o3, b=in[4], out=o4); Or(a=o4, b=in[5], out=o5); Or(a=o5, b=in[6], out=o6); Or(a=o6, b=in[7], out=out);',
  Mux4Way16: 'Mux16(a=a, b=b, sel=sel[0], out=ab); Mux16(a=c, b=d, sel=sel[0], out=cd); Mux16(a=ab, b=cd, sel=sel[1], out=out);',
  Mux8Way16: 'Mux4Way16(a=a, b=b, c=c, d=d, sel=sel[0..1], out=x); Mux4Way16(a=e, b=f, c=g, d=h, sel=sel[0..1], out=y); Mux16(a=x, b=y, sel=sel[2], out=out);',
  DMux4Way: 'DMux(in=in, sel=sel[1], a=x, b=y); DMux(in=x, sel=sel[0], a=a, b=b); DMux(in=y, sel=sel[0], a=c, b=d);',
  DMux8Way: 'DMux(in=in, sel=sel[2], a=x, b=y); DMux4Way(in=x, sel=sel[0..1], a=a, b=b, c=c, d=d); DMux4Way(in=y, sel=sel[0..1], a=e, b=f, c=g, d=h);',
  HalfAdder: 'Xor(a=a, b=b, out=sum); And(a=a, b=b, out=carry);',
  FullAdder: 'HalfAdder(a=a, b=b, sum=s1, carry=c1); HalfAdder(a=s1, b=c, sum=sum, carry=c2); Or(a=c1, b=c2, out=carry);',
  Add16: 'HalfAdder(a=a[0], b=b[0], sum=out[0], carry=c0); ' + Array.from({ length: 15 }, (_, k) => `FullAdder(a=a[${k + 1}], b=b[${k + 1}], c=c${k}, sum=out[${k + 1}], carry=c${k + 1});`).join(' '),
  Inc16: 'Add16(a=in, b[0]=true, out=out);',
  ALU: 'Mux16(a=x, b=false, sel=zx, out=x1); Not16(in=x1, out=nx1); Mux16(a=x1, b=nx1, sel=nx, out=x2); Mux16(a=y, b=false, sel=zy, out=y1); Not16(in=y1, out=ny1); Mux16(a=y1, b=ny1, sel=ny, out=y2); Add16(a=x2, b=y2, out=sum); And16(a=x2, b=y2, out=and); Mux16(a=and, b=sum, sel=f, out=o); Not16(in=o, out=no1); Mux16(a=o, b=no1, sel=no, out=out, out[15]=ng, out[0..7]=lo, out[8..15]=hi); Or8Way(in=lo, out=z1); Or8Way(in=hi, out=z2); Or(a=z1, b=z2, out=nz); Not(in=nz, out=zr);',
  Bit: 'Mux(a=fb, b=in, sel=load, out=m); DFF(in=m, out=out, out=fb);',
  Register: Array.from({ length: 16 }, (_, i) => `Bit(in=in[${i}], load=load, out=out[${i}]);`).join(' '),
  RAM8: 'DMux8Way(in=load, sel=address, a=l0, b=l1, c=l2, d=l3, e=l4, f=l5, g=l6, h=l7); ' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `Register(in=in, load=l${i}, out=r${i});`).join(' ') + ' Mux8Way16(a=r0, b=r1, c=r2, d=r3, e=r4, f=r5, g=r6, h=r7, sel=address, out=out);',
  RAM64: 'DMux8Way(in=load, sel=address[3..5], a=l0, b=l1, c=l2, d=l3, e=l4, f=l5, g=l6, h=l7); ' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `RAM8(in=in, load=l${i}, address=address[0..2], out=r${i});`).join(' ') + ' Mux8Way16(a=r0, b=r1, c=r2, d=r3, e=r4, f=r5, g=r6, h=r7, sel=address[3..5], out=out);',
  RAM512: 'DMux8Way(in=load, sel=address[6..8], a=l0, b=l1, c=l2, d=l3, e=l4, f=l5, g=l6, h=l7); ' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `RAM64(in=in, load=l${i}, address=address[0..5], out=r${i});`).join(' ') + ' Mux8Way16(a=r0, b=r1, c=r2, d=r3, e=r4, f=r5, g=r6, h=r7, sel=address[6..8], out=out);',
  RAM4K: 'DMux8Way(in=load, sel=address[9..11], a=l0, b=l1, c=l2, d=l3, e=l4, f=l5, g=l6, h=l7); ' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `RAM512(in=in, load=l${i}, address=address[0..8], out=r${i});`).join(' ') + ' Mux8Way16(a=r0, b=r1, c=r2, d=r3, e=r4, f=r5, g=r6, h=r7, sel=address[9..11], out=out);',
  RAM16K: 'DMux4Way(in=load, sel=address[12..13], a=l0, b=l1, c=l2, d=l3); ' + [0, 1, 2, 3].map((i) => `RAM4K(in=in, load=l${i}, address=address[0..11], out=r${i});`).join(' ') + ' Mux4Way16(a=r0, b=r1, c=r2, d=r3, sel=address[12..13], out=out);',
  Memory: 'DMux4Way(in=load, sel=address[13..14], a=r1, b=r2, c=s, d=k); Or(a=r1, b=r2, out=ram); RAM16K(in=in, load=ram, address=address[0..13], out=ro); Screen(in=in, load=s, address=address[0..12], out=so); Keyboard(out=ko); Mux4Way16(a=ro, b=ro, c=so, d=ko, sel=address[13..14], out=out);',
  CPU: 'Not(in=instruction[15], out=isA); Mux16(a=alu, b=instruction, sel=isA, out=ain); And(a=instruction[15], b=instruction[5], out=cA); Or(a=isA, b=cA, out=loadA); ARegister(in=ain, load=loadA, out=A, out[0..14]=addressM); And(a=instruction[15], b=instruction[4], out=loadD); DRegister(in=alu, load=loadD, out=D); Mux16(a=A, b=inM, sel=instruction[12], out=AM); ALU(x=D, y=AM, zx=instruction[11], nx=instruction[10], zy=instruction[9], ny=instruction[8], f=instruction[7], no=instruction[6], out=alu, out=outM, zr=zr, ng=ng); And(a=instruction[15], b=instruction[3], out=writeM); Or(a=zr, b=ng, out=zn); Not(in=zn, out=pos); And(a=instruction[2], b=ng, out=j1); And(a=instruction[1], b=zr, out=j2); And(a=instruction[0], b=pos, out=j3); Or(a=j1, b=j2, out=j12); Or(a=j12, b=j3, out=j); And(a=j, b=instruction[15], out=jump); PC(in=A, load=jump, inc=true, reset=reset, out[0..14]=pc);',
  Computer: 'ROM32K(address=pc, out=instr); CPU(inM=inM, instruction=instr, reset=reset, outM=outM, writeM=writeM, addressM=addr, pc=pc); Memory(in=outM, load=writeM, address=addr, out=inM);',
  PC: 'Inc16(in=fb, out=inc1); Mux16(a=fb, b=inc1, sel=inc, out=x1); Mux16(a=x1, b=in, sel=load, out=x2); Mux16(a=x2, b=false, sel=reset, out=x3); Register(in=x3, load=true, out=out, out=fb);',
}
const order = CHIPS.map((c) => c.name)
const allowedFor = (name: string) => (chip: string) => chip === 'Nand' || chip === 'DFF' || order.indexOf(chip) < order.indexOf(name)
const solve = (name: string) => skeleton(chipByName(name)!).replace('// Твоя реализация', P[name])

describe('HDL-движок', () => {
  for (const spec of BUILDABLE) {
    it(`эталонный ${spec.name} проходит тесты`, () => {
      const c = compile(solve(spec.name), spec, allowedFor(spec.name))
      const r = runTests(spec, c)
      expect(r.firstFail, JSON.stringify(r.firstFail)).toBeUndefined()
      expect(r.total).toBeGreaterThanOrEqual(2)
    })
  }
  it('ловит ошибки ученика', () => {
    const not = chipByName('Not')!
    expect(() => compile(skeleton(not).replace('// Твоя реализация', 'Nand(a=in, b=in, out=x);'), not, allowedFor('Not'))).toThrow(/выход out/)
    expect(() => compile(skeleton(not).replace('// Твоя реализация', 'And(a=in, b=in, out=out);'), not, allowedFor('Not'))).toThrow(/нельзя использовать/)
    expect(() => compile(skeleton(not).replace('// Твоя реализация', 'Nand(a=in, c=in, out=out);'), not, allowedFor('Not'))).toThrow(/нет вывода/)
    const and = chipByName('And')!
    const wrong = compile(skeleton(and).replace('// Твоя реализация', 'Nand(a=a, b=b, out=out);'), and, allowedFor('And'))
    expect(runTests(and, wrong).firstFail).toBeTruthy()
    const n16 = chipByName('Not16')!
    expect(() => compile(skeleton(n16).replace('// Твоя реализация', 'Not(in=in, out=out);'), n16, allowedFor('Not16'))).toThrow(/ширины/)
    const loop = chipByName('Or')!
    expect(() => runTests(loop, compile(skeleton(loop).replace('// Твоя реализация', 'Nand(a=a, b=x, out=x); Nand(a=x, b=x, out=out);'), loop, allowedFor('Or')))).toThrow(HdlError)
  })
})
