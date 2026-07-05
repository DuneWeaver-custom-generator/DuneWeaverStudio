# Dune Weaver THR Studio

Static web app for turning a logo/image into a filled `.thr` path.

## Pipeline

1. Load a PNG, JPEG, WEBP, or SVG.
2. Convert the image into a binary mask using transparency or brightness thresholding.
3. Trace that mask into vector contours for boundary passes and optional SVG export.
4. Generate interior ball motion from the mask with contour, maze, wave, image pattern, sweep, orbit, or spiral fills.
5. Convert the final continuous path into Theta Rho `.thr` rows.

The app uses the mask for fill decisions because that is more dependable for raster logos than forcing every image through SVG first. The SVG trace export is included as a checkpoint and reusable vector artifact.

## Shape-Following Fills

`Inset contour` creates nested rings from the ball-aware logo mask, so the motion follows the uploaded shape instead of cutting across it. This is usually the cleanest choice for bold logos and block lettering.

`Maze fill` builds a continuous grid walk inside each logo island. It gives the filled area a deliberate maze texture while avoiding the long scanline bridges that can make wave fills look scratched.

## Image Pattern Mode

Choose `Image pattern` in `Fill type` to turn the uploaded image into a repeated motif across the table. `Pattern density` controls the base repeat count, `Image size` controls the size of each repeat, and `Logo size` acts as an extra motif-size multiplier. When the logo is made smaller, the app automatically adds more repeats instead of shrinking the pattern into the center of the table. In this mode, the `Angle` slider rotates each repeated logo tile so long logos can be packed in a better direction.

Image pattern mode also adds one clipped concentric pass through the open sand between logos before drawing the logo tiles. Travel moves between separate logos prefer that already-drawn pass, which keeps the background cleaner than scattered diagonal bridges.

## Ball Size

The `Ball size` control is measured in millimeters. Set `Table dia.` to your Dune Weaver table diameter, defaulting to 250 mm, so the app can convert the physical ball size into the normalized `.thr` geometry. The setting changes the preview ball and clips generated fill paths so the ball footprint stays inside the uploaded logo mask.

Connectors are routed through the ball-aware mask whenever possible. Wave and sweep fills are stitched island-by-island, with the interior strokes ordered from the center outward before the outline pass. Reused travel over an existing groove is treated as a retrace in the preview, which keeps the visible connector lines focused on unavoidable bridges. If two completely separate islands must be connected in one continuous `.thr` file, one short bridge may still be unavoidable.

## Clear Modes

The `Clear from in` and `Clear from out` fill modes follow the same basic idea as the Dune Weaver `clear_from_in`, `clear_from_out`, `pro`, and `Ultra` pattern family: a dense polar clearing path that starts from the center or from the rim side. In this generator, that clearing path is clipped to the uploaded logo mask so intricate designs can be flattened inside the selected shape.

`Standard`, `Pro`, and `Ultra` increase the number of spiral turns and path points. Ultra is intentionally heavy and creates a much larger `.thr` file.
