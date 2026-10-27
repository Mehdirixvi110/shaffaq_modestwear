"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function WishlistButton({ productId }: { productId: number }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function add() { setBusy(true); setMessage(""); try { const response = await csrfFetch("/api/wishlist", { method: "POST", body: JSON.stringify({ productId, action: "ADD" }) }); if (!response.ok) throw new Error(await responseMessage(response)); setMessage("Saved to this browser's wishlist."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this product."); } finally { setBusy(false); } }
  return <div className="wishlist-control"><button className="button button--outline button--full" type="button" disabled={busy} onClick={add}>{busy ? "Saving…" : "Save to wishlist"}</button>{message ? <p className="fine-print" role="status">{message}</p> : null}</div>;
}
