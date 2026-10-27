"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Kind = "categories" | "collections";
type Item = { id: number; slug: string; name: string; description: string | null; imagePath: string | null; position: number; visible: number; archived: number; storefrontSort: "FEATURED" | "NEWEST" | "PRICE_ASC" | "PRICE_DESC"; version: number; productCount: number; productIds: number[] };
type Product = { id: number; title: string; status: string };
type Media = { id: number; displayName: string; publicPath: string };

function payload(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    slug: data.get("slug"),
    name: data.get("name"),
    description: String(data.get("description") ?? "").trim() || null,
    imagePath: String(data.get("imagePath") ?? "").trim() || null,
    position: Number(data.get("position")),
    visible: data.get("visible") === "on",
    storefrontSort: data.get("storefrontSort"),
    productIds: data.getAll("productIds").map(Number),
  };
}

export function AdminTaxonomyEditor({ kind, initialItems, products, media }: { kind: Kind; initialItems: Item[]; products: Product[]; media: Media[] }) {
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const singular = kind === "categories" ? "category" : "collection";

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusyId("new"); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/taxonomies/${kind}`, { method: "POST", body: JSON.stringify(payload(event.currentTarget)) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Could not create ${singular}.`); setBusyId(null); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault(); setBusyId(item.id); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/taxonomies/${kind}`, { method: "PATCH", body: JSON.stringify({ operation: "SAVE", id: item.id, expectedVersion: item.version, ...payload(event.currentTarget) }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Could not save ${singular}.`); setBusyId(null); }
  }

  async function archive(item: Item) {
    setBusyId(item.id); setMessage("");
    const operation = item.archived ? "RESTORE" : "ARCHIVE";
    try {
      const response = await csrfFetch(`/api/admin/taxonomies/${kind}`, { method: "PATCH", body: JSON.stringify({ operation, id: item.id, expectedVersion: item.version }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Could not ${operation.toLowerCase()} ${singular}.`); setBusyId(null); }
  }

  const fields = (item?: Item) => <div className="admin-form-grid">
    <label><span>Name</span><input name="name" defaultValue={item?.name} required maxLength={120} /></label>
    <label><span>Slug</span><input name="slug" defaultValue={item?.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={180} /></label>
    <label className="full"><span>Description</span><textarea name="description" defaultValue={item?.description ?? ""} rows={3} maxLength={2000} /></label>
    <label><span>Cover media</span><select name="imagePath" defaultValue={item?.imagePath ?? ""}><option value="">No cover</option>{media.map((medium) => <option key={medium.id} value={medium.publicPath}>{medium.displayName}</option>)}</select></label>
    <label><span>Storefront sort</span><select name="storefrontSort" defaultValue={item?.storefrontSort ?? "FEATURED"}><option value="FEATURED">Featured</option><option value="NEWEST">Newest</option><option value="PRICE_ASC">Price, low to high</option><option value="PRICE_DESC">Price, high to low</option></select></label>
    <label><span>Position</span><input name="position" type="number" min="0" max="100000" defaultValue={item?.position ?? initialItems.length} required /></label>
    <label className="checkbox-field"><input name="visible" type="checkbox" defaultChecked={item ? Boolean(item.visible) : true} /> Visible on storefront</label>
    <label className="full"><span>Assigned products</span><select name="productIds" multiple size={Math.min(10, Math.max(4, products.length))} defaultValue={item?.productIds.map(String) ?? []}>{products.map((product) => <option key={product.id} value={product.id}>{product.title} ({product.status.toLowerCase()})</option>)}</select><small>Use Ctrl or Command to select more than one. Assigning a product moves it from its previous {singular}.</small></label>
  </div>;

  return <>{message ? <p className="form-status" role="alert">{message}</p> : null}<details className="admin-card create-panel"><summary>Create {singular}</summary><form className="admin-form admin-form--nested" onSubmit={create}>{fields()}<button className="button button--dark" disabled={busyId === "new"}>Create {singular}</button></form></details>
    <div className="taxonomy-list">{initialItems.map((item) => <details className="admin-card" key={item.id}><summary><strong>{item.name}</strong> <span className="status-pill">{item.archived ? "Archived" : item.visible ? "Visible" : "Hidden"}</span> <small>Position {item.position} · {item.productCount} products · v{item.version}</small></summary><form className="admin-form admin-form--nested" onSubmit={(event) => save(event, item)}>{fields(item)}<div className="admin-actions"><button className="button button--dark" disabled={busyId === item.id}>Save</button><button className="button button--outline" type="button" disabled={busyId === item.id} onClick={() => archive(item)}>{item.archived ? "Restore" : "Archive"}</button></div></form></details>)}</div>
  </>;
}
