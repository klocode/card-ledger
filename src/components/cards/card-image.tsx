import Image from "next/image";

import { fetchCardImages } from "@/lib/scryfall";

// Scryfall's "normal" images are 488x680; the props carry that ratio so the
// slot doesn't shift when the art lands, while CSS sets the drawn size.
const INTRINSIC_WIDTH = 488;
const INTRINSIC_HEIGHT = 680;

/** Reserves the art's footprint so the header doesn't jump as it streams in. */
export function CardImageSkeleton() {
  return <div className="bg-muted h-[279px] w-[200px] shrink-0 animate-pulse rounded-lg" />;
}

export async function CardImage({
  name,
  printing,
}: {
  name: string;
  printing: string | null;
}) {
  const faces = await fetchCardImages(name, printing);
  if (faces.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {faces.map((face) => (
        <Image
          key={face.url}
          src={face.url}
          alt={face.name}
          title={face.name}
          width={INTRINSIC_WIDTH}
          height={INTRINSIC_HEIGHT}
          // Scryfall's CDN 400s the optimizer's upstream request (it rejects
          // the bare "node" user-agent it arrives with), so the browser loads
          // the art straight from source. No real loss: these are already
          // right-sized JPEGs on a CDN. The width/height above still hold the
          // slot against layout shift, and lazy-loading still applies.
          unoptimized
          className="h-auto w-[200px] rounded-lg shadow-sm"
        />
      ))}
    </div>
  );
}
