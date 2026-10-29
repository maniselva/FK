/**
 * googlePlacesClient.js
 *
 * Lightweight client-side wrapper around Google Maps JS Places library.
 * The backend's Places endpoint is blocked because our API key has HTTP-referer
 * restrictions. Google specifically supports running Places from the browser
 * with a referer-restricted key — so we call the JS API directly.
 */

let _scriptPromise = null;
let _apiKeyCache = null;

const BACKEND = process.env.REACT_APP_BACKEND_URL;

async function fetchApiKey() {
    if (_apiKeyCache) return _apiKeyCache;
    const res = await fetch(`${BACKEND}/api/google-maps/config`);
    const data = await res.json();
    _apiKeyCache = data.apiKey;
    return _apiKeyCache;
}

export async function loadGooglePlaces() {
    if (typeof window !== 'undefined' && window.google?.maps?.places) {
        return window.google;
    }
    if (_scriptPromise) return _scriptPromise;

    _scriptPromise = new Promise(async (resolve, reject) => {
        try {
            const apiKey = await fetchApiKey();
            if (!apiKey) {
                reject(new Error('Google Maps API key unavailable'));
                return;
            }

            // If a script tag is already injected by another component, just wait
            const existing = document.getElementById('google-maps-script');
            if (existing) {
                existing.addEventListener('load', () => resolve(window.google));
                existing.addEventListener('error', (e) => reject(e));
                // already loaded edge case
                if (window.google?.maps?.places) resolve(window.google);
                return;
            }

            const cb = `__googlePlacesCb_${Date.now()}`;
            window[cb] = () => {
                resolve(window.google);
                delete window[cb];
            };

            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src =
                `https://maps.googleapis.com/maps/api/js?key=${apiKey}` +
                `&v=weekly&libraries=places,geometry&callback=${cb}`;
            script.async = true;
            script.defer = true;
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        } catch (err) {
            reject(err);
        }
    });

    return _scriptPromise;
}

/**
 * Fetch live place predictions (landmarks, shops, businesses, addresses) as the
 * user types. Returns an array shaped like our existing AddressSearch suggestions:
 *   [{ placeId, description, mainText, secondaryText, lat?, lng? }]
 *
 * The `lat/lng` is only present after `resolvePlaceDetails` is called for the chosen
 * prediction, since AutocompleteService alone does not return coordinates.
 */
export async function searchPlacesClient(query, { biasLocation = null } = {}) {
    if (!query || query.length < 2) return [];

    const google = await loadGooglePlaces();
    if (!google?.maps?.places?.AutocompleteService) return [];

    return new Promise((resolve) => {
        const svc = new google.maps.places.AutocompleteService();
        const request = {
            input: query,
            componentRestrictions: { country: 'in' },
            // Broad type so we get restaurants, landmarks, shops, addresses together.
            // Omitting 'types' returns the broadest set (address + establishment + geocode).
        };
        if (biasLocation?.lat && biasLocation?.lng) {
            request.location = new google.maps.LatLng(biasLocation.lat, biasLocation.lng);
            request.radius = 50000; // 50 km bias
        }

        svc.getPlacePredictions(request, (preds, status) => {
            if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                Array.isArray(preds)
            ) {
                resolve(
                    preds.map((p) => ({
                        placeId: p.place_id,
                        description: p.description,
                        mainText:
                            p.structured_formatting?.main_text ||
                            p.description.split(',')[0],
                        secondaryText: p.structured_formatting?.secondary_text || '',
                        types: p.types || [],
                    }))
                );
            } else {
                resolve([]);
            }
        });
    });
}

/** Resolve a placeId into lat/lng + formatted address. */
export async function resolvePlaceDetails(placeId) {
    if (!placeId) return null;
    const google = await loadGooglePlaces();
    if (!google?.maps?.places?.PlacesService) return null;

    return new Promise((resolve) => {
        // PlacesService requires a DOM node or Map instance — an off-screen div works.
        const hostDiv = document.createElement('div');
        const svc = new google.maps.places.PlacesService(hostDiv);
        svc.getDetails(
            {
                placeId,
                fields: ['geometry', 'formatted_address', 'name'],
            },
            (place, status) => {
                if (
                    status === google.maps.places.PlacesServiceStatus.OK &&
                    place?.geometry?.location
                ) {
                    resolve({
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        address: place.formatted_address,
                        name: place.name,
                    });
                } else {
                    resolve(null);
                }
            }
        );
    });
}

/**
 * Reverse-geocode lat/lng → human-readable street address.
 * Runs in the browser so the referer-restricted API key is accepted.
 * Returns { address, lat, lng } or null.
 */
export async function reverseGeocodeClient(lat, lng) {
    if (lat == null || lng == null) return null;
    const google = await loadGooglePlaces();
    if (!google?.maps?.Geocoder) return null;

    return new Promise((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
            { location: { lat: Number(lat), lng: Number(lng) } },
            (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                    // results[0] is the most specific address — a rooftop / street address
                    resolve({
                        lat: Number(lat),
                        lng: Number(lng),
                        address: results[0].formatted_address,
                        placeId: results[0].place_id,
                    });
                } else {
                    resolve(null);
                }
            }
        );
    });
}
