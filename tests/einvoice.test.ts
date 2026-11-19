import { describe, expect, it } from 'vitest';
import { buildFactusBill, buyerProblems, invoiceTotals, nitDV, optionProblems, referenceCode, type Buyer } from '../src/lib/einvoice';
import { factusErrorText } from '../src/lib/factus';
import { open, seal } from '../src/lib/secret-box';

const buyer: Buyer = {
  name: 'Detalles SAS', doc: '900.123.456', doc_type: 'NIT', person_type: 'juridica', iva_responsable: true,
  email: 'compras@detalles.co', phone: '300 123 4567', address: 'Cra 1 # 2-3', municipality_id: '980',
};
const est = {
  number: 'COT-0001', notes: 'Pago a 30 días', discount_pct: 10, iva_pct: 19,
  items: [
    { id: 'a', name: 'Ancheta', desc: 'Con tarjeta', kind: 'Producto' as const, qty: 2, price: 50000, quote_id: 7 },
    { id: 'b', name: '', desc: '', kind: 'Producto' as const, qty: 1, price: 0 },
  ],
};

describe('factura electrónica', () => {
  it('calcula el dígito de verificación como la DIAN', () => {
    expect(nitDV('800197268')).toBe(4); // NIT de la DIAN
    expect(nitDV('860.034.313')).toBe(7); // Davivienda
    expect(nitDV('890903938')).toBe(8); // Bancolombia
  });

  it('lista lo que le falta al comprador', () => {
    expect(buyerProblems(buyer)).toEqual([]);
    expect(buyerProblems(undefined)).toHaveLength(1);
    const p = buyerProblems({ ...buyer, email: 'malo', municipality_id: '', doc: '' });
    expect(p.join()).toMatch(/Correo/);
    expect(p.join()).toMatch(/Municipio/);
    expect(p.join()).toMatch(/documento/);
  });

  it('pide fecha de vencimiento a crédito', () => {
    expect(optionProblems({ payment_form: '1', payment_method: '10' })).toEqual([]);
    expect(optionProblems({ payment_form: '2', payment_method: '10' }).join()).toMatch(/vencimiento/);
  });

  it('arma la factura para Factus con IVA incluido en el precio y descuento por línea', () => {
    const bill = buildFactusBill(est, buyer, { numbering_range_id: '8', iva_responsable: true }, { payment_form: '1', payment_method: '10' }, 'APV-1');
    expect(bill.numbering_range_id).toBe(8);
    expect(bill.customer).toMatchObject({ identification: '900123456', dv: String(nitDV('900123456')), company: 'Detalles SAS', names: '', legal_organization_id: '1', tribute_id: '18', identification_document_id: '6', phone: '3001234567' });
    expect(bill.items).toHaveLength(1); // la línea vacía no se factura
    expect(bill.items[0]).toMatchObject({ name: 'Ancheta – Con tarjeta', quantity: 2, discount_rate: 10, price: 59500, tax_rate: '19.00', is_excluded: 0, code_reference: '7' });
    expect(bill.payment_due_date).toBeUndefined();
  });

  it('no cobra IVA si quien factura no es responsable', () => {
    const bill = buildFactusBill(est, { ...buyer, doc_type: 'CC', person_type: 'natural', doc: '1.020.304' }, { numbering_range_id: '8', iva_responsable: false }, { payment_form: '2', payment_method: '47', due_date: '2026-12-31' }, 'APV-1');
    expect(bill.items[0]).toMatchObject({ price: 50000, tax_rate: '0.00', is_excluded: 1 });
    expect(bill.customer).toMatchObject({ identification: '1020304', dv: undefined, names: 'Detalles SAS', company: '', identification_document_id: '3' });
    expect(bill.payment_due_date).toBe('2026-12-31');
    expect(invoiceTotals(est, { iva_responsable: false }).total).toBe(90000);
    expect(invoiceTotals(est, { iva_responsable: true }).total).toBeCloseTo(107100, 5);
  });

  it('usa una referencia fija por cotización en producción', () => {
    expect(referenceCode(5, 9, false)).toBe('APV-5');
    expect(referenceCode(5, 9, true)).toBe('APV-5-P9');
  });

  it('explica los errores de Factus', () => {
    expect(factusErrorText({ message: 'Datos inválidos', data: { errors: { 'customer.email': ['no es válido'] } } }, 422)).toBe('Datos inválidos · customer.email: no es válido');
    expect(factusErrorText({}, 500)).toMatch(/500/);
  });

  it('cifra y descifra las claves guardadas', () => {
    process.env.AUTH_SECRET = 'x'.repeat(40);
    const s = seal('mi-clave');
    expect(s).not.toContain('mi-clave');
    expect(open(s)).toBe('mi-clave');
    expect(seal('')).toBe('');
    const bad = s.slice(0, -2) + (s.endsWith('A') ? 'BB' : 'AA');
    expect(() => open(bad)).toThrow();
  });
});
