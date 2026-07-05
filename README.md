# Dune Weaver THR Studio

Static web app for turning a logo/image into a filled `.thr` path.

## Pipeline

1. Load a PNG, JPEG, WEBP, or SVG.
2. Convert the image into a binary mask using transparency or brightness thresholding.
3. Trace that mask into vector contours for boundary passes and optional SVG export.
4. Generate interior ball motion from the mask with wave, sweep, orbit, or spiral fills.
5. Convert the final continuous path into Theta Rho `.thr` rows.

The app uses the mask for fill decisions because that is more dependable for raster logos than forcing every image through SVG first. The SVG trace export is included as a checkpoint and reusable vector artifact.

## GitHub Pages

Copy these files into a repository and publish the folder with GitHub Pages:

- `index.html`
- `styles.css`
- `app.js`

No build step or server is required.
