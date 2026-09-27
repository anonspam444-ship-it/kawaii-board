// Shrink a picked image in the browser before it is ever uploaded.
//
// Worth doing on the client rather than the server: a phone camera photo is
// 3-8MB, and sending that only to throw 95% of it away wastes the visitor's
// data, the request limit and the storage bucket. Everything here goes through
// a canvas, so the output is always a clean re-encode — EXIF, embedded colour
// profiles and any surprises in the original file do not survive.

const MAX_INPUT_BYTES = 25 * 1024 * 1024

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file doesn't look like an image."))
    }
    img.src = url
  })
}

function toDataUrl(canvas) {
  // JPEG for photographs; the alpha channel isn't worth the size here, and
  // every avatar and post image sits on an opaque card anyway.
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function prepare(file) {
  if (!file) throw new Error('No file chosen.')
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is enormous — pick a smaller one.')
  return loadImage(file)
}

// Square, centre-cropped — avatars are rendered in a circle, so anything else
// gets squashed or letterboxed.
export async function toSquareDataUrl(file, size = 256) {
  const img = await prepare(file)
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    (img.width - side) / 2, // crop to the middle
    (img.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  )

  return toDataUrl(canvas)
}

// Keeps the aspect ratio, bounded by the long edge. Small images are left
// alone rather than upscaled into mush.
export async function toBoundedDataUrl(file, maxEdge = 1400) {
  const img = await prepare(file)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return toDataUrl(canvas)
}
