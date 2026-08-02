import { useCallback, useEffect, useRef, useState } from "react";

// Product gallery, modelled on the familiar marketplace pattern: a large lead image, a
// thumbnail strip, arrows, and a zoom view.
//
// The rule throughout is that a photo is never cropped. `object-fit: contain` everywhere
// means the whole product is always visible; letterboxing is preferable to hiding the
// part of the item the buyer needed to see.

const SWIPE_THRESHOLD = 40;

export function AuctionGallery({ images = [], title = "Producto" }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  // Zoom origin as a percentage, so the magnified view follows the pointer.
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const touchStart = useRef(null);

  const count = images.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const current = images[safeIndex];

  const go = useCallback(
    (delta) => {
      if (count === 0) return;
      // Wrap around: from the last photo, "next" returns to the first.
      setIndex((value) => (value + delta + count) % count);
      setZoomed(false);
    },
    [count],
  );

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        setZoomed(false);
      }
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // The page behind the overlay must not scroll while the lightbox is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen, go]);

  if (count === 0) return null;

  const onTouchStart = (event) => {
    touchStart.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event) => {
    if (touchStart.current == null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    go(delta < 0 ? 1 : -1);
  };

  const trackPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  const arrows = count > 1 && (
    <>
      <button type="button" className="gallery__arrow gallery__arrow--prev" onClick={() => go(-1)} aria-label="Foto anterior">
        ‹
      </button>
      <button type="button" className="gallery__arrow gallery__arrow--next" onClick={() => go(1)} aria-label="Foto siguiente">
        ›
      </button>
    </>
  );

  return (
    <div className="gallery">
      <div className="gallery__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          className="gallery__main"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Ampliar foto ${safeIndex + 1} de ${count}`}
        >
          <img src={current.url} alt={`${title} — foto ${safeIndex + 1}`} decoding="async" />
          <span className="gallery__hint" aria-hidden="true">Ampliar</span>
        </button>
        {arrows}
        {count > 1 && (
          <span className="gallery__counter" aria-hidden="true">
            {safeIndex + 1} / {count}
          </span>
        )}
      </div>

      {count > 1 && (
        <ul className="gallery__thumbs">
          {images.map((image, position) => (
            <li key={image.id ?? image.url}>
              <button
                type="button"
                className={`gallery__thumb${position === safeIndex ? " gallery__thumb--active" : ""}`}
                onClick={() => {
                  setIndex(position);
                  setZoomed(false);
                }}
                aria-label={`Ver foto ${position + 1}`}
                aria-current={position === safeIndex}
              >
                <img src={image.url} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxOpen && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, foto ${safeIndex + 1} de ${count}`}
          onClick={() => {
            setLightboxOpen(false);
            setZoomed(false);
          }}
        >
          <button type="button" className="lightbox__close" aria-label="Cerrar">×</button>

          <div
            className="lightbox__stage"
            // The overlay closes on background clicks, so the image itself must not
            // bubble its own clicks up.
            onClick={(event) => event.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <img
              className={`lightbox__image${zoomed ? " lightbox__image--zoomed" : ""}`}
              src={current.url}
              alt={`${title} — foto ${safeIndex + 1}`}
              style={zoomed ? { transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
              onMouseMove={zoomed ? trackPointer : undefined}
              onClick={(event) => {
                trackPointer(event);
                setZoomed((value) => !value);
              }}
            />
            {arrows}
          </div>

          <p className="lightbox__caption" onClick={(event) => event.stopPropagation()}>
            {safeIndex + 1} / {count} · {zoomed ? "Toca la imagen para alejar" : "Toca la imagen para acercar"}
          </p>
        </div>
      )}
    </div>
  );
}
