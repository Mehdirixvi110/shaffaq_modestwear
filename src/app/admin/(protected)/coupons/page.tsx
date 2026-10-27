import { AdminCoupons } from "@/components/admin-coupons";
import { getAdminCoupons } from "@/server/admin-data";

export default function AdminCouponsPage() {
  const data = getAdminCoupons();
  return <><header className="admin-heading"><div><p className="eyebrow">Promotions</p><h1>Coupons</h1><p>Server-validated percentage, fixed PKR, and free-shipping rules.</p></div></header><AdminCoupons initialCoupons={data.coupons as never} products={data.products} collections={data.collections} /></>;
}
