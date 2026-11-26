import { describe, expect, it } from 'vitest'
import { OS_STAGES, checkOsClass } from '../src/code/JackLab'

// Эталонные классы ОС на Jack — чтобы проверить сами тесты проекта 12.
const REF: Record<string, string> = {
  Math: `class Math {
  function int abs(int x) { if (x < 0) { return -x; } return x; }
  function int multiply(int x, int y) { var int sum, shifted, i, bit; let sum = 0; let shifted = x; let i = 0; let bit = 1;
    while (i < 16) { if (~((y & bit) = 0)) { let sum = sum + shifted; } let shifted = shifted + shifted; let bit = bit + bit; let i = i + 1; } return sum; }
  function int divide(int x, int y) { var int q; var boolean neg; let neg = ((x < 0) & (y > 0)) | ((x > 0) & (y < 0)); let q = Math.div(Math.abs(x), Math.abs(y)); if (neg) { return -q; } return q; }
  function int div(int x, int y) { var int q; if ((y > x) | (y < 0)) { return 0; } let q = Math.div(x, y + y); if ((x - (2 * q * y)) < y) { return q + q; } return q + q + 1; }
  function int sqrt(int x) { var int y, j, t, t2; let y = 0; let j = 7; while (~(j < 0)) { let t = y + Math.pow2(j); let t2 = t * t; if (~(t2 > x) & (t2 > 0)) { let y = t; } let j = j - 1; } return y; }
  function int pow2(int j) { var int r; let r = 1; while (j > 0) { let r = r + r; let j = j - 1; } return r; }
  function int max(int a, int b) { if (a > b) { return a; } return b; }
  function int min(int a, int b) { if (a < b) { return a; } return b; }
}`,
  String: `class String {
  field Array chars; field int length, maxLength;
  constructor String new(int maxLen) { if (maxLen = 0) { let maxLen = 1; } let chars = Array.new(maxLen); let maxLength = maxLen; let length = 0; return this; }
  method void dispose() { do chars.dispose(); do Memory.deAlloc(this); return; }
  method int length() { return length; }
  method char charAt(int j) { return chars[j]; }
  method void setCharAt(int j, char c) { let chars[j] = c; return; }
  method String appendChar(char c) { let chars[length] = c; let length = length + 1; return this; }
  method void eraseLastChar() { if (length > 0) { let length = length - 1; } return; }
  method int intValue() { var int v, i; var boolean neg; let i = 0; let v = 0; if (chars[0] = 45) { let neg = true; let i = 1; }
    while ((i < length) & (chars[i] > 47) & (chars[i] < 58)) { let v = (v * 10) + (chars[i] - 48); let i = i + 1; } if (neg) { return -v; } return v; }
  method void setInt(int val) { let length = 0; if (val < 0) { do appendChar(45); let val = -val; } do setDigits(val); return; }
  method void setDigits(int v) { var int q; let q = v / 10; if (q > 0) { do setDigits(q); } do appendChar(48 + (v - (q * 10))); return; }
  function char newLine() { return 128; }
  function char backSpace() { return 129; }
  function char doubleQuote() { return 34; }
}`,
  Memory: `class Memory {
  static Array ram; static int free;
  function void init() { let ram = 0; let free = 2048; let ram[2048] = 14000; let ram[2049] = 0; return; }
  function int peek(int a) { return ram[a]; }
  function void poke(int a, int v) { let ram[a] = v; return; }
  function int alloc(int size) { var int prev, cur, block; let prev = 0; let cur = free;
    while (~(cur = 0)) { if (ram[cur] > (size + 1)) { let ram[cur] = ram[cur] - (size + 1); let block = cur + ram[cur]; let ram[block] = size + 1; return block + 1; } let cur = ram[cur + 1]; }
    return 0; }
  function void deAlloc(int o) { var int b; let b = o - 1; let ram[b + 1] = free; let free = b; return; }
}`,
  Screen: `class Screen {
  static boolean color; static Array bits;
  function void init() { var int i, v; let color = true; let bits = Array.new(16); let i = 0; let v = 1; while (i < 16) { let bits[i] = v; let v = v + v; let i = i + 1; } return; }
  function void clearScreen() { return; }
  function void setColor(boolean b) { let color = b; return; }
  function void drawPixel(int x, int y) { var int a; let a = 16384 + (32 * y) + (x / 16);
    if (color) { do Memory.poke(a, Memory.peek(a) | bits[x & 15]); } else { do Memory.poke(a, Memory.peek(a) & ~bits[x & 15]); } return; }
  function void drawLine(int x1, int y1, int x2, int y2) { var int dx, dy, sx, sy, err, e2;
    let dx = Math.abs(x2 - x1); let dy = -Math.abs(y2 - y1); let sx = 1; let sy = 1; if (x1 > x2) { let sx = -1; } if (y1 > y2) { let sy = -1; } let err = dx + dy;
    while (true) { do Screen.drawPixel(x1, y1); if ((x1 = x2) & (y1 = y2)) { return; } let e2 = err + err; if (~(e2 < dy)) { let err = err + dy; let x1 = x1 + sx; } if (~(e2 > dx)) { let err = err + dx; let y1 = y1 + sy; } }
    return; }
  function void drawRectangle(int x1, int y1, int x2, int y2) { var int y, x; let y = y1; while (~(y > y2)) { let x = x1; while (~(x > x2)) { do Screen.drawPixel(x, y); let x = x + 1; } let y = y + 1; } return; }
  function void drawCircle(int cx, int cy, int r) { var int dy, w, x; let dy = -r; while (~(dy > r)) { let w = Math.sqrt((r * r) - (dy * dy)); let x = cx - w; while (~(x > (cx + w))) { do Screen.drawPixel(x, cy + dy); let x = x + 1; } let dy = dy + 1; } return; }
}`,
}

describe('Проект 12: тесты классов ОС', () => {
  for (const st of OS_STAGES) {
    it(`эталонный ${st.cls} проходит`, () => {
      for (const r of checkOsClass(st, REF[st.cls])) expect(r.ok, `${r.name}: ${r.msg}`).toBe(true)
    })
    it(`заготовка ${st.cls} не проходит`, () => {
      expect(checkOsClass(st, st.starter).some((r) => !r.ok)).toBe(true)
    })
  }
})
