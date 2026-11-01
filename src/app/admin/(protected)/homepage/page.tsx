import Link from "next/link";
import { AdminHomepageEditor } from "@/components/admin-homepage-editor";
import { getAdminHomepage, getAdminLookups } from "@/server/admin-data";

export default async function AdminHomepagePage() {
  const [{ settings, sections }, { media }] = await Promise.all([getAdminHomepage(), getAdminLookups()]);
  return <><header className="admin-heading"><div><p className="eyebrow">Content</p><h1>Homepage</h1></div><Link className="button button--outline" href="/">Open storefront</Link></header><AdminHomepageEditor initialSettings={settings} initialSections={sections as never} media={media} /></>;
}
