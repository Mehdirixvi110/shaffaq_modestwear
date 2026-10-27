import { AdminPoliciesEditor } from "@/components/admin-policies-editor";
import { getAdminPolicies } from "@/server/admin-data";

export default function AdminPoliciesPage() { return <><header className="admin-heading"><div><p className="eyebrow">Persisted content</p><h1>Policies & pages</h1><p>Templates remain visibly labelled until you record review.</p></div></header><AdminPoliciesEditor initialPolicies={getAdminPolicies()} /></>; }
