import { AdminMediaUploader } from "@/components/admin-media-uploader";
import { getAdminMedia } from "@/server/admin-data";

export default async function AdminMediaPage() {
  const media = await getAdminMedia();
  return <><header className="admin-heading"><div><p className="eyebrow">Persistent media storage</p><h1>Media</h1><p>New uploads are fully decoded, pixel-limited, metadata-stripped, re-encoded, and stored through the configured media provider. Supplied originals remain untouched.</p></div></header><AdminMediaUploader initialMedia={media} /></>;
}
