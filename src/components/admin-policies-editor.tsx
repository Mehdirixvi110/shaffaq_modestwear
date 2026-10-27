"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Policy = { id: number; slug: string; title: string; content: string; isTemplate: number };

export function AdminPoliciesEditor({ initialPolicies }: { initialPolicies: Policy[] }) {
  const [policies, setPolicies] = useState(initialPolicies); const [message, setMessage] = useState(""); const [busyId, setBusyId] = useState<number | null>(null);
  const update = (id: number, changes: Partial<Policy>) => setPolicies((current) => current.map((policy) => policy.id === id ? { ...policy, ...changes } : policy));
  async function save(policy: Policy) { setBusyId(policy.id); setMessage(""); try { const response = await csrfFetch(`/api/admin/policies/${policy.id}`, { method: "PATCH", body: JSON.stringify({ title: policy.title, content: policy.content, reviewed: !Boolean(policy.isTemplate) }) }); if (!response.ok) throw new Error(await responseMessage(response)); setMessage(`${policy.title} saved.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save policy."); } finally { setBusyId(null); } }
  return <div className="policy-editors">{policies.map((policy) => <details className="admin-card" key={policy.id}><summary><strong>{policy.title}</strong> <span className="status-pill">{policy.isTemplate ? "Template" : "Reviewed"}</span></summary><div className="admin-form-grid"><label><span>Title</span><input value={policy.title} onChange={(event) => update(policy.id, { title: event.target.value })} /></label><label className="checkbox-field"><input type="checkbox" checked={!Boolean(policy.isTemplate)} onChange={(event) => update(policy.id, { isTemplate: event.target.checked ? 0 : 1 })} /> Record owner review complete</label><label className="full"><span>Content</span><textarea rows={10} value={policy.content} onChange={(event) => update(policy.id, { content: event.target.value })} /></label><div><button className="button button--dark" type="button" disabled={busyId === policy.id} onClick={() => save(policy)}>Save {policy.title}</button></div></div></details>)}{message ? <p className="form-status" role="status">{message}</p> : null}</div>;
}
