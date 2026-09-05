# Onboarding a new organization

This document collects the assets and information needed to stand up a new
organization in Respond. It's a work in progress — more sections will be added over time.

## Brand icon

Bring these images (PNG, not SVG):

- **512x512** — square, plain (no maskable safe zone needed).
- **192x192** — square, plain.
- **512x512 maskable** — content kept within the center "safe zone" so it doesn't get
  cropped by adaptive icon shapes (Android home screen, etc). Use
  [maskable.app/editor](https://maskable.app/editor) to create this from your logo.
- **192x192 maskable** — same as above, at 192x192.

The plain and maskable images are usually the same logo, just with the maskable
version padded/positioned to survive the safe-zone crop.

Convert each PNG to a `data:` URI with
[base64.guru's PNG encoder](https://base64.guru/converter/encode/image/png) (set output
to **Data URI**), then set the four values on the org's document under `brand.icon`:

```
brand.icon = {
  512: "<data URI for the 512x512 plain image>",
  192: "<data URI for the 192x192 plain image>",
  maskable: {
    512: "<data URI for the 512x512 maskable image>",
    192: "<data URI for the 192x192 maskable image>",
  },
}
```

<!-- TODO: org document field reference, domain/DNS setup, member provider config, etc. -->
