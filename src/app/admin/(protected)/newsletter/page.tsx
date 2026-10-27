import { formatDate } from "@/lib/format";
import { getAdminNewsletter } from "@/server/admin-data";

export default function AdminNewsletterPage() {
  const subscriptions = getAdminNewsletter();
  return <><header className="admin-heading"><div><p className="eyebrow">Consent ledger</p><h1>Newsletter</h1><p>No email sending is configured or claimed.</p></div></header>{subscriptions.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email</th><th>Status</th><th>Consent timestamp</th><th>Source</th><th>Unsubscribed</th></tr></thead><tbody>{subscriptions.map((entry) => <tr key={String(entry.id)}><td>{String(entry.email)}</td><td><span className="status-pill">{entry.unsubscribedAt ? "Unsubscribed" : "Consented"}</span></td><td>{formatDate(Number(entry.consentedAt))}</td><td>{String(entry.consentSource)}</td><td>{entry.unsubscribedAt ? formatDate(Number(entry.unsubscribedAt)) : "—"}</td></tr>)}</tbody></table></div> : <div className="admin-card">No newsletter consent records.</div>}</>;
}
