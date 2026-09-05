export function GoogleMapEmbed({ lat, lon, address }: { lat?: string; lon?: string; address?: string }) {
  const query = lat && lon ? `${lat},${lon}` : address;
  if (!query) return <></>;
  return <iframe src={`https://maps.google.com/maps?q=${query}&hl=es;&output=embed`} width="100%" height="450" loading="lazy"></iframe>;
}
