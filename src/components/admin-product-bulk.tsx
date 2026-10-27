"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Product = { id: string | number; title: string | number | null; status: string | number | null };

export function AdminProductBulk({ products }: { products: Product[] }) {
  const router = useRouter(); const [ids, setIds] = useState<number[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function action(name: "PUBLISH" | "ARCHIVE" | "DUPLICATE") { setBusy(true); setMessage(""); try { const response = await csrfFetch("/api/admin/products/bulk", { method: "POST", body: JSON.stringify({ action: name, ids }) }); if (!response.ok) throw new Error(await responseMessage(response)); const result = await response.json() as { duplicatedId: number | null }; if (result.duplicatedId) router.push(`/admin/products/${result.duplicatedId}`); else window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Bulk action failed."); setBusy(false); } }
  return <div className="admin-card product-bulk"><label><span>Select products for bulk action</span><select multiple size={Math.min(8, Math.max(4, products.length))} value={ids.map(String)} onChange={(event) => setIds([...event.currentTarget.selectedOptions].map((option) => Number(option.value)))}>{products.map((product) => <option key={Number(product.id)} value={Number(product.id)}>{String(product.title)} ({String(product.status).toLowerCase()})</option>)}</select></label><div className="admin-actions"><button className="button button--dark" type="button" disabled={busy || !ids.length} onClick={() => action("PUBLISH")}>Publish selected</button><button className="button button--outline" type="button" disabled={busy || !ids.length} onClick={() => action("ARCHIVE")}>Archive selected</button><button className="button button--outline" type="button" disabled={busy || ids.length !== 1} onClick={() => action("DUPLICATE")}>Duplicate one as draft</button></div>{message ? <p className="form-status" role="alert">{message}</p> : null}</div>;
}
