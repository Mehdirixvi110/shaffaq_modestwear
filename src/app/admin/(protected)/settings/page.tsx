import { AdminSettingsForm } from "@/components/admin-settings-form";
import { AdminShippingRegions } from "@/components/admin-shipping-regions";
import { getAdminShippingRegions } from "@/server/admin-data";
import { getSettings } from "@/server/store";

export default function AdminSettingsPage() {
  return <><header className="admin-heading"><div><p className="eyebrow">Operations and market preparation</p><h1>Settings</h1></div></header><AdminSettingsForm initialSettings={getSettings()} /><AdminShippingRegions initialRegions={getAdminShippingRegions() as never} /></>;
}
