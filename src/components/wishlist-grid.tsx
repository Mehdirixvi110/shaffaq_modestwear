"use client";

import { useState } from "react";
import type { ProductSummary } from "@/server/store";
import { ProductGrid } from "./product-grid";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function WishlistGrid({ initialItems }: { initialItems: ProductSummary[] }) {
  const [items, setItems] = useState(initialItems); const [message, setMessage] = useState("");
  async function remove(productId: number) { setMessage(""); const response = await csrfFetch("/api/wishlist", { method: "POST", body: JSON.stringify({ productId, action: "REMOVE" }) }); if (!response.ok) { setMessage(await responseMessage(response)); return; } setItems((await response.json() as { items: ProductSummary[] }).items); }
  if (!items.length) return <div className="empty-state"><h2>Your wishlist is empty</h2><p>Saved products are stored only for this browser using an opaque cookie.</p></div>;
  return <>{message ? <p className="form-status" role="alert">{message}</p> : null}<ProductGrid products={items} /><div className="wishlist-remove-list">{items.map((item) => <button className="text-button" type="button" key={item.id} onClick={() => remove(item.id)}>Remove {item.title}</button>)}</div></>;
}
