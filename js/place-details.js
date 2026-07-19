// Detailansicht (Modal) für einen gespeicherten Ort: weitere Fotos +
// Rezensionen via Places API (New) "Place Details", aufgerufen per Klick auf
// einen Ort in Plan/Route (nur wenn `place.placeId` vorhanden ist, also aus
// einer Places-Suche stammt). Orte aus park4night (placeId-Präfix "p4n:")
// laufen über einen eigenen, schlankeren Zweig, siehe renderPark4nightDetail().

import { CONFIG } from "./config.js";
import { photoUrl, starRating } from "./places-search.js";
import { friendlyError } from "./errors.js";
import { fetchPark4nightReviewsFor } from "./park4night.js";

async function fetchPlaceDetails(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": CONFIG.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": [
        "displayName", "formattedAddress", "rating", "userRatingCount",
        "googleMapsUri", "photos", "reviews",
      ].join(","),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places-API-Fehler ${res.status}: ${body}`);
  }
  return res.json();
}

function renderPark4nightReview(review) {
  const li = document.createElement("li");
  li.className = "place-review";

  const head = document.createElement("div");
  head.className = "place-review-head";
  const author = document.createElement("span");
  author.className = "place-review-author";
  author.textContent = review.uuid || "Anonym";
  const rating = document.createElement("span");
  rating.className = "muted";
  rating.textContent = `${starRating(Number(review.note) || 0)}${review.date_creation ? ` · ${review.date_creation.slice(0, 10)}` : ""}`;
  head.append(author, rating);

  const text = document.createElement("p");
  text.className = "place-review-text";
  text.textContent = review.commentaire || "";

  li.append(head, text);
  return li;
}

// park4night hat keinen "Ort per ID neu abrufen"-Endpunkt (nur
// Koordinaten-Suche + Reviews) -- anders als bei Google zeigt die
// Detailansicht deshalb nur das bereits gespeicherte Foto (photoRef) groß
// statt einer vollen Galerie, dafür aber frisch geladene Rezensionen.
async function renderPark4nightDetail(place, panel, loading) {
  if (place.photoRef) {
    const img = document.createElement("img");
    img.className = "place-detail-photo";
    img.src = place.photoRef;
    img.alt = place.name || "";
    panel.insertBefore(img, loading);
  }

  if (place.address) {
    const addr = document.createElement("p");
    addr.className = "muted";
    addr.textContent = place.address;
    panel.insertBefore(addr, loading);
  }

  if (place.note) {
    const amenities = document.createElement("p");
    amenities.className = "muted";
    amenities.textContent = `Ausstattung: ${place.note}`;
    panel.insertBefore(amenities, loading);
  }

  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Community-Daten von park4night.";
  panel.insertBefore(hint, loading);

  const reviews = await fetchPark4nightReviewsFor(place.placeId.slice(4));
  loading.remove();

  if (reviews.length) {
    const heading = document.createElement("div");
    heading.className = "trip-meta";
    heading.textContent = "Rezensionen";
    panel.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "place-reviews-list";
    reviews.forEach((r) => list.appendChild(renderPark4nightReview(r)));
    panel.appendChild(list);
  }
}

function closeModal() {
  const root = document.getElementById("place-detail-modal");
  root.classList.add("hidden");
  root.innerHTML = "";
}

function renderReview(review) {
  const li = document.createElement("li");
  li.className = "place-review";

  const head = document.createElement("div");
  head.className = "place-review-head";
  const author = document.createElement("span");
  author.className = "place-review-author";
  author.textContent = review.authorAttribution?.displayName || "Anonym";
  const rating = document.createElement("span");
  rating.className = "muted";
  rating.textContent = `${starRating(review.rating || 0)}${review.relativePublishTimeDescription ? ` · ${review.relativePublishTimeDescription}` : ""}`;
  head.append(author, rating);

  const text = document.createElement("p");
  text.className = "place-review-text";
  text.textContent = review.text?.text || "";

  li.append(head, text);
  return li;
}

export async function openPlaceDetailModal(place) {
  const root = document.getElementById("place-detail-modal");
  root.innerHTML = "";
  root.classList.remove("hidden");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", closeModal);

  const panel = document.createElement("div");
  panel.className = "modal-panel";
  panel.addEventListener("click", (e) => e.stopPropagation());

  const closeBtn = document.createElement("button");
  closeBtn.className = "trip-icon-btn modal-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Schließen");
  closeBtn.addEventListener("click", closeModal);

  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = place.name || "Ort";

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Lädt weitere Infos …";

  panel.append(closeBtn, title, loading);
  backdrop.appendChild(panel);
  root.appendChild(backdrop);

  if (place.placeId?.startsWith("p4n:")) {
    try {
      await renderPark4nightDetail(place, panel, loading);
    } catch (err) {
      loading.textContent = `Fehler beim Laden: ${friendlyError(err)}`;
      console.error(err);
    }
    return;
  }

  try {
    const details = await fetchPlaceDetails(place.placeId);
    loading.remove();

    if (details.photos?.length) {
      const gallery = document.createElement("div");
      gallery.className = "inspire-photo-gallery";
      details.photos.slice(0, 10).forEach((p) => {
        const img = document.createElement("img");
        img.src = photoUrl(p.name, 500);
        img.alt = details.displayName?.text || "";
        gallery.appendChild(img);
      });
      panel.appendChild(gallery);
    }

    if (details.rating || details.googleMapsUri) {
      const link = document.createElement("a");
      link.className = "btn btn-ghost-dark";
      link.target = "_blank";
      link.rel = "noopener";
      link.href = details.googleMapsUri || "#";
      link.textContent = details.rating
        ? `${starRating(details.rating)} ${details.rating} (${details.userRatingCount || 0}) auf Google Maps ↗`
        : "Auf Google Maps ansehen ↗";
      panel.appendChild(link);
    }

    if (details.formattedAddress) {
      const addr = document.createElement("p");
      addr.className = "muted";
      addr.textContent = details.formattedAddress;
      panel.appendChild(addr);
    }

    if (details.reviews?.length) {
      const heading = document.createElement("div");
      heading.className = "trip-meta";
      heading.textContent = "Rezensionen";
      panel.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "place-reviews-list";
      details.reviews.slice(0, 8).forEach((r) => list.appendChild(renderReview(r)));
      panel.appendChild(list);
    }
  } catch (err) {
    loading.textContent = `Fehler beim Laden: ${friendlyError(err)}`;
    console.error(err);
  }
}
