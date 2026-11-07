import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatPkr } from "@/lib/format";
import { getAdminCustomerDetail } from "@/server/admin-data";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  // The URL segment carries digits only (no "+" to encode). Order phones are stored
  // normalized as "+92XXXXXXXXXX", so reconstruct that form to match exactly.
  const digits = phone.replace(/\D/g, "");
  const detail = await getAdminCustomerDetail(`+${digits}`);
  if (!detail) notFound();
  const summary = detail.summary;
  const address = detail.latestAddress;
  const addressLine = address ? [address.addressLine1, address.addressLine2, address.city, address.region, address.postalCode].filter(Boolean).join(", ") : "";
  return <>
    <header className="admin-heading">
      <div><p className="eyebrow">Customer · order history</p><h1>{String(summary.customerName) || "Customer"}</h1><p>{String(summary.phone)}{summary.email ? ` · ${String(summary.email)}` : ""}</p></div>
      <Link className="text-link" href="/admin/customers">← All customers</Link>
    </header>
    <div className="admin-card">
      <p><strong>{Number(summary.orderCount)}</strong> orders · <strong>{formatPkr(Number(summary.orderedPkr))}</strong> ordered · <strong>{formatPkr(Number(summary.collectedPkr))}</strong> COD collected</p>
      <p className="fine-print">First order {formatDate(Number(summary.firstOrderAt))} · Last order {formatDate(Number(summary.lastOrderAt))}</p>
      {addressLine ? <p className="fine-print">Most recent delivery address: {addressLine}</p> : null}
    </div>
    <section className="admin-section">
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Status</th><th>Payment</th><th>Source</th><th>Total</th><th>City</th><th>Date</th></tr></thead><tbody>
        {detail.orders.map((order) => <tr key={String(order.id)}>
          <td><Link className="text-link" href={`/admin/orders/${order.id}`}>{String(order.reference)}</Link></td>
          <td>{String(order.orderStatus)}</td>
          <td>{String(order.paymentStatus)}</td>
          <td>{String(order.source)}</td>
          <td>{formatPkr(Number(order.totalPkr))}</td>
          <td>{String(order.city ?? "")}</td>
          <td>{formatDate(Number(order.createdAt))}</td>
        </tr>)}
      </tbody></table></div>
    </section>
    <section className="admin-section"><div className="admin-card"><strong>Account boundary</strong><p>This history is derived from immutable order contact snapshots keyed by phone. No separate customer record is stored, and no customer data is exposed on public routes.</p></div></section>
  </>;
}
