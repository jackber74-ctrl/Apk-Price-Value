// Factura electrónica de venta (DIAN, Colombia) a partir de una cotización.
// La firma, el CUFE, el XML UBL 2.1 y el envío a la DIAN los hace el proveedor tecnológico (Factus).
// Aquí solo se arma lo que se le manda y se revisa que no falte ningún dato del comprador.

import { estimateTotals, type EstimateItem } from './estimate';

/** Tipos de documento del comprador, con el id que usa Factus. */
export const DOC_TYPES = {
  CC: { label: 'Cédula de ciudadanía', factus: 3 },
  NIT: { label: 'NIT', factus: 6 },
  CE: { label: 'Cédula de extranjería', factus: 5 },
  TI: { label: 'Tarjeta de identidad', factus: 2 },
  PP: { label: 'Pasaporte', factus: 7 },
  PEP: { label: 'Permiso especial de permanencia (PEP)', factus: 9 },
  NITE: { label: 'NIT de otro país', factus: 10 },
} as const;
export type DocType = keyof typeof DOC_TYPES;

/** Medios de pago (códigos DIAN). */
export const PAYMENT_METHODS: Record<string, string> = {
  '10': 'Efectivo',
  '47': 'Transferencia bancaria',
  '42': 'Consignación bancaria',
  '48': 'Tarjeta crédito',
  '49': 'Tarjeta débito',
  '20': 'Cheque',
  '1': 'Otro / no definido',
};

export type Buyer = {
  name: string;
  doc: string;
  doc_type: string;
  person_type: string; // 'natural' | 'juridica'
  iva_responsable: boolean;
  email: string;
  phone: string;
  address: string;
  municipality_id: string;
  city?: string;
};

export type IssueOptions = {
  payment_form: '1' | '2'; // 1 contado, 2 crédito
  payment_method: string;
  due_date?: string; // AAAA-MM-DD, obligatorio a crédito
};

export type SellerSettings = {
  numbering_range_id: string;
  iva_responsable: boolean;
  /** Factus recibe el precio unitario con el IVA ya incluido. */
  price_includes_tax?: boolean;
};

type Estimate = { number: string; items: EstimateItem[]; discount_pct: number; iva_pct: number; notes: string };

/** Solo los dígitos del documento. */
export const digits = (s: string) => String(s ?? '').replace(/\D/g, '');

/** Dígito de verificación del NIT con el algoritmo de la DIAN. */
export function nitDV(nit: string): number {
  const d = digits(nit);
  const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  for (let i = 0; i < d.length && i < w.length; i++) sum += Number(d[d.length - 1 - i]) * w[i];
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lo que le falta al comprador para poder facturarle. Lista vacía = listo. */
export function buyerProblems(b: Partial<Buyer> | null | undefined): string[] {
  if (!b) return ['Elige un cliente en la cotización.'];
  const out: string[] = [];
  if (!String(b.name ?? '').trim()) out.push('Nombre o razón social');
  if (!(String(b.doc_type ?? '') in DOC_TYPES)) out.push('Tipo de documento');
  const doc = b.doc_type === 'PP' || b.doc_type === 'NITE' ? String(b.doc ?? '').trim() : digits(b.doc ?? '');
  if (doc.length < 3) out.push('Número de documento (NIT o cédula)');
  if (!EMAIL.test(String(b.email ?? '').trim())) out.push('Correo electrónico (ahí le llega la factura)');
  if (!String(b.address ?? '').trim()) out.push('Dirección');
  if (!String(b.municipality_id ?? '').trim()) out.push('Municipio');
  if (b.doc_type === 'NIT' && b.person_type !== 'juridica' && b.person_type !== 'natural') out.push('Tipo de persona');
  return out;
}

export function optionProblems(o: IssueOptions): string[] {
  const out: string[] = [];
  if (o.payment_form !== '1' && o.payment_form !== '2') out.push('Forma de pago');
  if (!(o.payment_method in PAYMENT_METHODS)) out.push('Medio de pago');
  if (o.payment_form === '2' && !/^\d{4}-\d{2}-\d{2}$/.test(o.due_date ?? '')) out.push('Fecha de vencimiento (pago a crédito)');
  return out;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Arma el cuerpo de POST /v1/bills/validate de Factus.
 * El descuento general de la cotización se aplica como % de descuento en cada línea; el IVA solo si quien factura es responsable.
 */
export function buildFactusBill(est: Estimate, buyer: Buyer, seller: SellerSettings, opts: IssueOptions, reference: string) {
  const ivaPct = seller.iva_responsable ? Math.max(Number(est.iva_pct) || 0, 0) : 0;
  const discount = Math.min(Math.max(Number(est.discount_pct) || 0, 0), 100);
  const withTax = seller.price_includes_tax !== false;
  const isNit = buyer.doc_type === 'NIT';
  const docType = DOC_TYPES[buyer.doc_type as DocType] ?? DOC_TYPES.CC;
  const id = buyer.doc_type === 'PP' || buyer.doc_type === 'NITE' ? buyer.doc.trim() : digits(buyer.doc);
  const juridica = buyer.person_type === 'juridica';
  const items = est.items.filter((i) => Number(i.qty) > 0 && String(i.name ?? '').trim());

  return {
    numbering_range_id: Number(seller.numbering_range_id) || undefined,
    reference_code: reference,
    observation: String(est.notes ?? '').slice(0, 250),
    payment_form: opts.payment_form,
    payment_due_date: opts.payment_form === '2' ? opts.due_date : undefined,
    payment_method_code: opts.payment_method,
    customer: {
      identification: id,
      dv: isNit ? String(nitDV(id)) : undefined,
      company: juridica ? buyer.name.trim() : '',
      trade_name: '',
      names: juridica ? '' : buyer.name.trim(),
      address: buyer.address.trim(),
      email: buyer.email.trim(),
      phone: digits(buyer.phone) || undefined,
      legal_organization_id: juridica ? '1' : '2',
      tribute_id: buyer.iva_responsable ? '18' : '21',
      identification_document_id: String(docType.factus),
      municipality_id: String(buyer.municipality_id),
    },
    items: items.map((i, n) => ({
      code_reference: String(i.quote_id ?? `L${n + 1}`),
      name: [i.name.trim(), String(i.desc ?? '').trim()].filter(Boolean).join(' – ').slice(0, 300),
      quantity: Number(i.qty),
      discount_rate: discount,
      price: round2(Number(i.price) * (withTax ? 1 + ivaPct / 100 : 1)),
      tax_rate: ivaPct.toFixed(2),
      unit_measure_id: 70, // unidad
      standard_code_id: 1, // estándar de adopción del contribuyente
      is_excluded: seller.iva_responsable ? 0 : 1,
      tribute_id: 1, // IVA
      withholding_taxes: [],
    })),
  };
}

/** Totales que debe tener la factura, para mostrarlos antes de emitir. */
export function invoiceTotals(est: Estimate, seller: Pick<SellerSettings, 'iva_responsable'>) {
  return estimateTotals(est.items, est.discount_pct, seller.iva_responsable ? est.iva_pct : 0);
}

/** Código de referencia que se manda al proveedor. En producción es fijo por cotización para que un reintento no duplique la factura. */
export function referenceCode(estimateId: number, invoiceId: number, sandbox: boolean) {
  return sandbox ? `APV-${estimateId}-P${invoiceId}` : `APV-${estimateId}`;
}
