"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import type { GalleryImage } from "./gallery-images";

type GalleryGridProps = {
  images: readonly GalleryImage[];
};

export default function GalleryGrid({ images }: Readonly<GalleryGridProps>) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const isOpen = selectedIndex !== null;

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const showPreviousImage = useCallback(() => {
    setSelectedIndex((currentIndex) =>
      currentIndex === null
        ? currentIndex
        : (currentIndex - 1 + images.length) % images.length,
    );
  }, [images.length]);

  const showNextImage = useCallback(() => {
    setSelectedIndex((currentIndex) =>
      currentIndex === null ? currentIndex : (currentIndex + 1) % images.length,
    );
  }, [images.length]);

  function openLightbox(index: number): void {
    openerRef.current = document.activeElement as HTMLElement | null;
    setSelectedIndex(index);
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) {
      closeLightbox();
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    if (dialog && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      openerRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyboardNavigation(event: KeyboardEvent): void {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextImage();
      }
    }

    window.addEventListener("keydown", handleKeyboardNavigation);

    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation);
    };
  }, [isOpen, showNextImage, showPreviousImage]);

  const selectedImage =
    selectedIndex === null ? null : images[selectedIndex] ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-6">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => openLightbox(index)}
            aria-label={`Open gallery image ${index + 1} of ${images.length}: ${image.alt}`}
            className="group relative aspect-3/4 overflow-hidden rounded-2xl bg-artis-off-white shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/40"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1280px) 405px, (min-width: 768px) calc(50vw - 34px), (min-width: 480px) calc(50vw - 32px), calc(100vw - 48px)"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading={index === 0 ? "eager" : "lazy"}
            />

            <span className="absolute right-3 bottom-3 rounded-full bg-artis-deep-navy/90 px-3 py-1.5 text-xs font-semibold text-artis-white shadow-sm">
              View photo
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClick={closeFromBackdrop}
        onCancel={(event) => {
          event.preventDefault();
          closeLightbox();
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-artis-white backdrop:bg-artis-deep-navy/95"
        aria-labelledby="gallery-lightbox-title"
        aria-describedby="gallery-lightbox-description"
      >
        {selectedImage && selectedIndex !== null ? (
          <div className="grid h-full grid-rows-[auto_1fr_auto] p-4 sm:p-6 xl:p-8">
            <div className="flex min-h-12 items-center justify-between gap-4">
              <div>
                <h2 id="gallery-lightbox-title" className="sr-only">
                  Gallery image viewer
                </h2>
                <p aria-live="polite" className="text-sm font-semibold sm:text-base">
                  Image {selectedIndex + 1} of {images.length}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeLightbox}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-artis-white/40 bg-artis-deep-navy/80 px-5 text-sm font-semibold transition hover:border-artis-gold hover:text-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/50"
                aria-label="Close gallery image viewer"
              >
                Close
              </button>
            </div>

            <div className="relative min-h-0 w-full py-4 sm:px-16">
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={showPreviousImage}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-artis-white/40 bg-artis-deep-navy/80 px-4 text-sm font-semibold transition hover:border-artis-gold hover:text-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/50 sm:px-5"
                aria-label="Show previous image"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ←
                </span>
                <span className="ml-2 hidden sm:inline">Previous</span>
              </button>

              <p
                id="gallery-lightbox-description"
                className="max-w-2xl text-center text-xs leading-5 text-artis-white/85 sm:text-sm"
              >
                {selectedImage.alt}
              </p>

              <button
                type="button"
                onClick={showNextImage}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-artis-white/40 bg-artis-deep-navy/80 px-4 text-sm font-semibold transition hover:border-artis-gold hover:text-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/50 sm:px-5"
                aria-label="Show next image"
              >
                <span className="mr-2 hidden sm:inline">Next</span>
                <span aria-hidden="true" className="text-xl leading-none">
                  →
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
