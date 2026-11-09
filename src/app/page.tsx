import { Hero } from "@/components/hero";
import { HomeSections } from "@/components/home-sections";
import { getHomepageSections, getSettings, listProducts } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, sections, products] = await Promise.all([getSettings(), getHomepageSections(), listProducts({ limit: 8 })]);
  return <><Hero settings={settings} /><HomeSections sections={sections} featured={products.products} /></>;
}
