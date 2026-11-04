import { money } from '@/lib/format';
import { DEFAULT_BRAND, isHex, readableOn, tint } from '@/lib/brand';
import type { EstimateItem } from '@/lib/estimate';

export type DocProfile = { name: string; logo: string | null; brand_color: string | null; biz_nit: string; biz_phone: string; biz_email: string; biz_address: string };
type Customer = { name: string; doc: string; email: string; phone: string; address: string } | undefined;
type Totals = { subtotal: number; discount: number; iva: number; total: number };
type Doc = { number: string; title: string; issue_date: string; valid_days: number; items: EstimateItem[]; discount_pct: number; iva_pct: number; notes: string };

/** La cotización tal como la recibe el cliente: es lo que se imprime o se guarda en PDF. */
export default function EstimateDoc({ profile, doc, customer, totals }: { profile: DocProfile | null; doc: Doc; customer: Customer; totals: Totals }) {
  const brand = isHex(profile?.brand_color) ? (profile!.brand_color as string) : DEFAULT_BRAND;
  const ink = readableOn(brand);
  const soft = tint(brand, 0.92);
  const date = new Date(String(doc.issue_date).slice(0, 10) + 'T12:00:00');
  const until = new Date(date.getTime() + Number(doc.valid_days || 0) * 86400000);
  const fmt = (d: Date) => (Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }));
  const contact = [profile?.biz_nit && `NIT ${profile.biz_nit}`, profile?.biz_phone, profile?.biz_email, profile?.biz_address].filter(Boolean);

  return (
    <article className="est-doc" style={{ ['--brand' as string]: brand, ['--brand-ink' as string]: ink, ['--brand-soft' as string]: soft }}>
      <header className="est-head">
        <div className="est-brand">
          {profile?.logo && <img src={profile.logo} alt="Logo" className="est-logo" />}
          <div>
            <strong className="est-biz">{profile?.name || 'Mi negocio'}</strong>
            {contact.map((c, i) => <div key={i} className="est-small">{c}</div>)}
          </div>
        </div>
        <div className="est-title">
          <div className="est-word">COTIZACIÓN</div>
          <div className="est-num">{doc.number}</div>
        </div>
      </header>

      <div className="est-meta">
        <div>
          <div className="est-label">Cliente</div>
          <strong>{customer?.name || '—'}</strong>
          {customer && [customer.doc, customer.phone, customer.email, customer.address].filter(Boolean).map((c, i) => <div key={i} className="est-small">{c}</div>)}
        </div>
        <div className="est-dates">
          <div><span className="est-label">Fecha</span> {fmt(date)}</div>
          {Number(doc.valid_days) > 0 && <div><span className="est-label">Válida hasta</span> {fmt(until)}</div>}
        </div>
      </div>
      {doc.title && <div className="est-subject">{doc.title}</div>}

      <table className="est-table">
        <thead>
          <tr><th>Descripción</th><th className="r">Cant.</th><th className="r">Valor unitario</th><th className="r">Total</th></tr>
        </thead>
        <tbody>
          {doc.items.map((i) => (
            <tr key={i.id}>
              <td>
                <strong>{i.name || '—'}</strong>
                {i.desc && <div className="est-small">{i.desc}</div>}
              </td>
              <td className="r">{i.qty}</td>
              <td className="r">{money(i.price)}</td>
              <td className="r">{money(i.qty * i.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="est-bottom">
        <div className="est-notes">
          {doc.notes && (
            <>
              <div className="est-label">Observaciones</div>
              <p>{doc.notes}</p>
            </>
          )}
        </div>
        <div className="est-totals">
          <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
          {totals.discount > 0 && <div><span>Descuento ({doc.discount_pct} %)</span><span>− {money(totals.discount)}</span></div>}
          {totals.iva > 0 && <div><span>IVA ({doc.iva_pct} %)</span><span>{money(totals.iva)}</span></div>}
          <div className="est-grand"><span>TOTAL</span><span>{money(totals.total)}</span></div>
        </div>
      </div>
    </article>
  );
}
