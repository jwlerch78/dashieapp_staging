// js/utils/geocoding-helper.js
// v1.3 - 10/9/25 - Fixed getLocationName to use reverse geocoding for reliable city/state display
// v1.2 - 10/9/25 - Added reverse geocoding and browser geolocation for automatic zip detection
// v1.1 - 10/9/25 - Added getLocationName function for city/state/country display
// v1.0 - 10/9/25 - Initial implementation for zip code to coordinates conversion

import { createLogger } from './logger.js';
const logger = createLogger('GeocodingHelper');

/**
 * Geocode a US zip code to latitude/longitude coordinates
 * Uses Nominatim OpenStreetMap API (free, no API key required)
 * 
 * @param {string} zipCode - US zip code (5 or 9 digit format)
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
export async function geocodeZipCode(zipCode) {
  if (!zipCode || typeof zipCode !== 'string') {
    logger.warn('Invalid zip code provided', { zipCode });
    return null;
  }
  
  // Clean the zip code (remove spaces, dashes)
  const cleanZip = zipCode.trim().replace(/[\s-]/g, '');
  
  // Validate format (5 or 9 digits)
  if (!/^\d{5}(\d{4})?$/.test(cleanZip)) {
    logger.warn('Zip code format invalid', { zipCode, cleanZip });
    return null;
  }
  
  // Use first 5 digits for geocoding
  const zip5 = cleanZip.substring(0, 5);
  
  try {
    logger.debug('Geocoding zip code', { zipCode: zip5 });
    
    // Nominatim requires a User-Agent header
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip5}&country=us&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Dashie/1.0 (Family Dashboard)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      logger.warn('No results found for zip code', { zipCode: zip5 });
      return null;
    }
    
    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon)
    };
    
    logger.info('Geocoding successful', { 
      zipCode: zip5, 
      latitude: result.latitude, 
      longitude: result.longitude 
    });
    
    return result;
    
  } catch (error) {
    logger.error('Geocoding failed', { 
      zipCode: zip5, 
      error: error.message 
    });
    return null;
  }
}

/**
 * Geocode with caching to reduce API calls
 * Cache persists in memory for the session
 */
const geocodeCache = new Map();

export async function geocodeZipCodeCached(zipCode) {
  const cleanZip = zipCode?.trim().replace(/[\s-]/g, '').substring(0, 5);
  
  if (!cleanZip) {
    return null;
  }
  
  // Check cache first
  if (geocodeCache.has(cleanZip)) {
    logger.debug('Using cached geocoding result', { zipCode: cleanZip });
    return geocodeCache.get(cleanZip);
  }
  
  // Fetch and cache
  const result = await geocodeZipCode(zipCode);
  
  if (result) {
    geocodeCache.set(cleanZip, result);
  }
  
  return result;
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodeCache() {
  geocodeCache.clear();
  logger.debug('Geocoding cache cleared');
}

/**
 * Get location name (city, state, country) from zip code
 * @param {string} zipCode - US zip code
 * @returns {Promise<string|null>} - Formatted location string or null
 */
export async function getLocationName(zipCode) {
  if (!zipCode || typeof zipCode !== 'string') {
    return null;
  }
  
  const cleanZip = zipCode.trim().replace(/[\s-]/g, '');
  
  if (!/^\d{5}(\d{4})?$/.test(cleanZip)) {
    return null;
  }
  
  const zip5 = cleanZip.substring(0, 5);
  
  // Check cache first
  const cached = getCachedLocationName(zip5);
  if (cached) {
    logger.debug('Using cached location name', { zipCode: zip5, locationName: cached });
    return cached;
  }
  
  try {
    // Use REVERSE geocoding with the zip's coordinates
    // First, search for the zip to get coordinates
    const searchUrl = `https://nominatim.openstreetmap.org/search?postalcode=${zip5}&country=us&format=json&limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Dashie/1.0 (Family Dashboard)'
      }
    });
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData || searchData.length === 0) {
      return null;
    }
    
    // Now reverse geocode those coordinates to get detailed address
    const { lat, lon } = searchData[0];
    
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    
    const reverseResponse = await fetch(reverseUrl, {
      headers: {
        'User-Agent': 'Dashie/1.0 (Family Dashboard)'
      }
    });
    
    if (!reverseResponse.ok) {
      return null;
    }
    
    const reverseData = await reverseResponse.json();
    const address = reverseData.address || {};
    
    logger.debug('Nominatim reverse result for manually entered zip', { 
      zipCode: zip5,
      address,
      displayName: reverseData.display_name
    });
    
    // Build location string from reverse geocoding (same as auto-detection)
    const city = address.city || address.town || address.village || address.hamlet;
    const state = address.state;
    const country = address.country_code?.toUpperCase() || 'US';
    
    let locationName = country; // Fallback
    if (city && state) {
      const stateAbbr = getStateAbbreviation(state);
      locationName = `${city}, ${stateAbbr} ${country}`;
    } else if (state) {
      locationName = `${state}, ${country}`;
    } else if (city) {
      locationName = `${city}, ${country}`;
    }
    
    // Cache it for next time
    locationNameCache.set(zip5, locationName);
    
    logger.info('Location name resolved for zip', { zipCode: zip5, locationName });
    return locationName;
    
  } catch (error) {
    logger.error('Failed to get location name', { zipCode: zip5, error: error.message });
    return null;
  }
}

/**
 * Get state abbreviation from full state name
 * @param {string} stateName - Full state name
 * @returns {string} - State abbreviation or original name
 */
function getStateAbbreviation(stateName) {
  const stateMap = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };
  
  return stateMap[stateName] || stateName;
}

/**
 * Reverse geocode coordinates to zip code
 * Used for browser geolocation on first login
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<{zipCode: string, locationName: string}|null>} - Zip code and location name, or null
 */
export async function reverseGeocodeToZip(latitude, longitude) {
  if (!latitude || !longitude) {
    logger.warn('Invalid coordinates for reverse geocoding', { latitude, longitude });
    return null;
  }
  
  try {
    logger.info('Reverse geocoding coordinates to zip code', { latitude, longitude });
    
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Dashie/1.0 (Family Dashboard)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.address) {
      logger.warn('No address data in reverse geocoding response');
      return null;
    }
    
    const address = data.address;
    const zipCode = address.postcode;
    
    if (zipCode) {
      // Validate it's a US zip code format
      const cleanZip = zipCode.replace(/[\s-]/g, '');
      if (/^\d{5}(\d{4})?$/.test(cleanZip)) {
        const zip5 = cleanZip.substring(0, 5);
        
        // Build location name from the address data we already have
        const city = address.city || address.town || address.village || address.hamlet;
        const state = address.state;
        const country = address.country_code?.toUpperCase() || 'US';
        
        let locationName = country; // Fallback
        if (city && state) {
          const stateAbbr = getStateAbbreviation(state);
          locationName = `${city}, ${stateAbbr} ${country}`;
        } else if (state) {
          locationName = `${state}, ${country}`;
        } else if (city) {
          locationName = `${city}, ${country}`;
        }
        
        logger.info('Reverse geocoding successful', { 
          latitude, 
          longitude, 
          zipCode: zip5,
          city,
          state,
          locationName
        });
        
        return { zipCode: zip5, locationName };
      } else {
        logger.warn('Reverse geocoded zip code is not valid US format', { zipCode });
        return null;
      }
    } else {
      logger.warn('No zip code in reverse geocoding response');
      return null;
    }
    
  } catch (error) {
    logger.error('Reverse geocoding failed', { 
      latitude, 
      longitude, 
      error: error.message 
    });
    return null;
  }
}

/**
 * Cache for zip code → location name mappings
 * Avoids redundant API calls
 */
const locationNameCache = new Map();

/**
 * Get browser geolocation and convert to zip code
 * Used for automatic location detection on first login
 * @returns {Promise<{zipCode: string, locationName: string}|null>} - Zip and location, or null if denied/failed
 */
export async function getZipFromBrowserLocation() {
  // Check if geolocation is available
  if (!navigator.geolocation) {
    logger.warn('Browser geolocation not available');
    return null;
  }
  
  logger.info('Requesting browser geolocation for automatic zip detection');
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        logger.info('Browser geolocation obtained', { latitude, longitude });
        
        // Reverse geocode to zip code AND location name
        const result = await reverseGeocodeToZip(latitude, longitude);
        
        if (result) {
          // Cache the location name for this zip code
          locationNameCache.set(result.zipCode, result.locationName);
          logger.info('Cached location name for zip', { 
            zipCode: result.zipCode, 
            locationName: result.locationName 
          });
        }
        
        resolve(result);
      },
      (error) => {
        // User denied or error occurred - fail gracefully
        logger.warn('Browser geolocation denied or failed', { 
          code: error.code, 
          message: error.message 
        });
        resolve(null);
      },
      {
        timeout: 10000, // 10 second timeout
        maximumAge: 300000, // Accept cached position up to 5 minutes old
        enableHighAccuracy: false // Don't need GPS-level accuracy for zip code
      }
    );
  });
}

/**
 * Get cached location name for a zip code
 * @param {string} zipCode - US zip code
 * @returns {string|null} - Cached location name or null
 */
export function getCachedLocationName(zipCode) {
  const cleanZip = zipCode?.trim().replace(/[\s-]/g, '').substring(0, 5);
  return locationNameCache.get(cleanZip) || null;
}
