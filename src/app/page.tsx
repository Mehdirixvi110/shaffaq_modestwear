import { Hero } from "@/components/hero";
import { HomeSections } from "@/components/home-sections";
import { getHomepageSections, getSettings, listProducts } from "@/server/store";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const settings = getSettings();
  const sections = getHomepageSections();
  const featured = listProducts({ limit: 8 }).products;
  return <><Hero settings={settings} /><div className="sample-ribbon">Sample catalogue for setup. Product facts, stock, prices, policies, and media remain editable in Admin.</div><HomeSections sections={sections} featured={featured} /></>;
}
