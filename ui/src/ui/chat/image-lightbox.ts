/**
 * Image Lightbox — lightweight click-to-zoom image viewer.
 *
 * Opens a full-screen overlay displaying the clicked image.
 * Supports: click backdrop to close, Escape key, close button.
 *
 * CN-only module.
 */

let activeLightbox: HTMLElement | null = null;

/**
 * Open an image in a lightbox overlay.
 */
export function openImageLightbox(imageUrl: string): void {
  // Close any existing lightbox first
  closeLightbox();

  const overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Image preview");

  const backdrop = document.createElement("div");
  backdrop.className = "image-lightbox__backdrop";

  const img = document.createElement("img");
  img.className = "image-lightbox__img";
  img.src = imageUrl;
  img.alt = "Full-size preview";

  const closeBtn = document.createElement("button");
  closeBtn.className = "image-lightbox__close";
  closeBtn.innerHTML = "&times;";
  closeBtn.setAttribute("aria-label", "Close preview");
  closeBtn.type = "button";

  overlay.appendChild(backdrop);
  overlay.appendChild(img);
  overlay.appendChild(closeBtn);

  // Close on backdrop click or close button
  backdrop.addEventListener("click", closeLightbox);
  closeBtn.addEventListener("click", closeLightbox);

  // Close on Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeLightbox();
    }
  };
  document.addEventListener("keydown", handleKeydown);

  // Store cleanup reference
  overlay.dataset.keydownCleanup = "true";
  (overlay as unknown as { _keydownHandler: (e: KeyboardEvent) => void })._keydownHandler =
    handleKeydown;

  document.body.appendChild(overlay);
  activeLightbox = overlay;

  // Prevent body scroll
  document.body.style.overflow = "hidden";

  // Focus close button for accessibility
  closeBtn.focus();
}

function closeLightbox(): void {
  if (!activeLightbox) return;

  const overlay = activeLightbox;
  activeLightbox = null;

  // Clean up keydown listener
  const handler = (overlay as unknown as { _keydownHandler?: (e: KeyboardEvent) => void })
    ._keydownHandler;
  if (handler) {
    document.removeEventListener("keydown", handler);
  }

  // Restore body scroll
  document.body.style.overflow = "";

  overlay.remove();
}
