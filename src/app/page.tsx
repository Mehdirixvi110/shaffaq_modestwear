import { Hero } from "@/components/hero";
import { HomeSections } from "@/components/home-sections";
import { getHomepageSections, getSettings, listProducts } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, sections, products] = await Promise.all([getSettings(), getHomepageSections(), listProducts({ limit: 8 })]);
  return <><Hero settings={settings} /><div className="sample-ribbon">Sample catalogue for setup. Product facts, stock, prices, policies, and media remain editable in Admin.</div><HomeSections sections={sections} featured={products.products} /></>;
}
