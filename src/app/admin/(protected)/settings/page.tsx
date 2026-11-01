import { AdminSettingsForm } from "@/components/admin-settings-form";
import { AdminShippingRegions } from "@/components/admin-shipping-regions";
import { getAdminShippingRegions } from "@/server/admin-data";
import { getSettings } from "@/server/store";

export default async function AdminSettingsPage() {
  const [settings, regions] = await Promise.all([getSettings(), getAdminShippingRegions()]);
  return <><header className="admin-heading"><div><p className="eyebrow">Operations and market preparation</p><h1>Settings</h1></div></header><AdminSettingsForm initialSettings={settings} /><AdminShippingRegions initialRegions={regions as never} /></>;
}
