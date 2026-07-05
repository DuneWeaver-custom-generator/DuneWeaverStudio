# Dune Weaver THR Studio

Static web app for turning a logo/image into a filled `.thr` path.

## Pipeline

1. Load a PNG, JPEG, WEBP, or SVG.
2. Convert the image into a binary mask using transparency or brightness thresholding.
3. Trace that mask into vector contours for boundary passes and optional SVG export.
4. Generate interior ball motion from the mask with wave, sweep, orbit, or spiral fills.
5. Convert the final continuous path into Theta Rho `.thr` rows.

The app uses the mask for fill decisions because that is more dependable for raster logos than forcing every image through SVG first. The SVG trace export is included as a checkpoint and reusable vector artifact.

## Ball Size

The `Ball size` control is measured as a percent of the table diameter. It changes the preview ball and clips generated fill paths so the ball footprint stays inside the uploaded logo mask.

## Clear Modes

The `Clear from in` and `Clear from out` fill modes follow the same basic idea as the Dune Weaver `clear_from_in`, `clear_from_out`, `pro`, and `Ultra` pattern family: a dense polar clearing path that starts from the center or from the rim side. In this generator, that clearing path is clipped to the uploaded logo mask so intricate designs can be flattened inside the selected shape.

`Standard`, `Pro`, and `Ultra` increase the number of spiral turns and path points. Ultra is intentionally heavy and creates a much larger `.thr` file.

## GitHub Pages

Upload the full contents of this folder to the root of your GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`
- `.github/workflows/pages.yml`

The workflow deploys the static site with GitHub Pages Actions. In the repository settings, make sure **Settings -> Pages -> Source** is set to **GitHub Actions**. If GitHub shows `Deployment failed, try again later` after the artifact is created, rerun the job once; that message often happens on GitHub's deployment side after the site files have already been packaged.
