export function GoogleMapEmbed({ lat, lon }: { lat: string; lon: string }) {
  if (!lat || !lon) return <></>;
  const src = `https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d2697.0319068940435!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2s!5e0!3m2!1sen!2sus!4v1739232064509!5m2!1sen!2sus`;
  return <iframe src={src} width="100%" height="450" loading="lazy"></iframe>;
}
