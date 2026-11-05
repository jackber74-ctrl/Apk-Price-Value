import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { confirmationValue, validConfirmation } from '../src/lib/payu';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const KEY = '4Vj8eK4rloUd272L48hsrarnUA';

describe('PayU', () => {
  it('la cadena de firma coincide con el ejemplo de la documentación', () => {
    expect(md5(`${KEY}~508029~TestPayU~3~USD`)).toBe('ba9ffa71559580175585e45ce70b6c37');
  });
  it('valor de confirmación con uno o dos decimales', () => {
    expect(confirmationValue('150.00')).toBe('150.0');
    expect(confirmationValue('150.26')).toBe('150.26');
    expect(confirmationValue('150.20')).toBe('150.2');
    expect(confirmationValue('4000.00')).toBe('4000.0');
  });
  it('acepta solo confirmaciones bien firmadas', () => {
    const f = { merchant_id: '508029', reference_sale: '5:pro:annual:x', value: '28000.00', currency: 'COP', state_pol: '4' };
    const sign = md5(`${KEY}~508029~5:pro:annual:x~28000.0~COP~4`);
    expect(validConfirmation({ ...f, sign }, KEY)).toBe(true);
    expect(validConfirmation({ ...f, sign, value: '1000.00' }, KEY)).toBe(false);
    expect(validConfirmation({ ...f, sign: 'x' }, KEY)).toBe(false);
  });
});
