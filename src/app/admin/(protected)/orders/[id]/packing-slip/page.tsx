import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { formatDate } from "@/lib/format";
import { getAdminOrder } from "@/server/admin-data";

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const order = getAdminOrder((await params).id) as Record<string, unknown> | null; if (!order) notFound(); const items = order.items as Array<Record<string, unknown>>;
  return <article className="print-document"><header><div><p className="eyebrow">SHAFFAQ packing slip</p><h1>{String(order.reference)}</h1><p>Created {formatDate(Number(order.createdAt))}</p></div><PrintButton /></header><section><h2>Deliver to</h2><p>{String(order.customerName)}<br />{String(order.addressLine1)}{order.addressLine2 ? `, ${String(order.addressLine2)}` : ""}<br />{String(order.city)}{order.region ? `, ${String(order.region)}` : ""}, Pakistan<br />{String(order.phone)}</p></section><table className="admin-table"><thead><tr><th>Pack</th><th>Item</th><th>SKU</th><th>Quantity</th></tr></thead><tbody>{items.map((item) => <tr key={Number(item.id)}><td>☐</td><td>{String(item.productTitle)} · {String(item.variantTitle)}</td><td>{String(item.sku)}</td><td>{Number(item.quantity)}</td></tr>)}</tbody></table>{order.notes ? <section><h2>Customer note</h2><p>{String(order.notes)}</p></section> : null}<p><strong>Courier:</strong> {order.courierName ? String(order.courierName) : "Not assigned"}<br /><strong>Tracking:</strong> {order.trackingNumber ? String(order.trackingNumber) : "Not assigned"}</p><p className="fine-print">This document uses the immutable item and address snapshots captured at checkout. It does not confirm courier API delivery.</p></article>;
}
