import { AdminMediaUploader } from "@/components/admin-media-uploader";
import { getAdminMedia } from "@/server/admin-data";

export default function AdminMediaPage() { return <><header className="admin-heading"><div><p className="eyebrow">Local persistent storage</p><h1>Media</h1><p>New uploads are fully decoded, pixel-limited, metadata-stripped, re-encoded, and stored outside the application build. Supplied originals remain untouched.</p></div></header><AdminMediaUploader initialMedia={getAdminMedia()} /></>; }
