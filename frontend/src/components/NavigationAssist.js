import React, { useState, useEffect, useRef } from 'react';
import { Navigation, MapPin, AlertTriangle, Phone, Route, Clock, Map } from 'lucide-react';

function NavigationAssist({ addNotification }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [safetyScore, setSafetyScore] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);
  const scriptLoadedRef = useRef(false);
  const initAttemptRef = useRef(0);
  
  const [emergencyContacts] = useState([
    { name: 'Emergency Services', phone: '112' },
    { name: 'Police', phone: '100' },
  ]);

  // 🗺️ Load Google Maps API Key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/maps-key');
        const data = await response.json();
        if (data.success) {
          setApiKey(data.apiKey);
        }
      } catch (error) {
        console.error('Failed to fetch API key:', error);
        addNotification('❌ Failed to load maps', 'error');
      }
    };
    fetchApiKey();
  }, []);

  // 🗺️ Load Google Maps Script
  useEffect(() => {
    if (!apiKey || scriptLoadedRef.current) return;

    const loadGoogleMapsScript = () => {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          // Wait for google.maps to be fully available
          const checkGoogleMaps = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.Map) {
              clearInterval(checkGoogleMaps);
              scriptLoadedRef.current = true;
              resolve();
            }
          }, 100);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkGoogleMaps);
            if (!scriptLoadedRef.current) {
              reject(new Error('Google Maps loading timeout'));
            }
          }, 5000);
        };
        
        script.onerror = () => reject(new Error('Failed to load Google Maps script'));
        document.head.appendChild(script);
      });
    };

    loadGoogleMapsScript()
      .then(() => {
        setMapReady(true);
      })
      .catch(error => {
        console.error('Google Maps loading error:', error);
        addNotification('❌ Failed to load Google Maps', 'error');
      });
  }, [apiKey]);

  // 🗺️ Initialize the map when ready
  useEffect(() => {
    if (!mapReady || !currentLocation || !mapRef.current || googleMapRef.current) return;

    // Additional safety check
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
      console.warn('Google Maps not ready, retrying...');
      initAttemptRef.current += 1;
      
      if (initAttemptRef.current < 5) {
        setTimeout(() => {
          setMapReady(false);
          setTimeout(() => setMapReady(true), 100);
        }, 500);
      }
      return;
    }

    try {
      const mapOptions = {
        center: { lat: currentLocation.lat, lng: currentLocation.lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3ff' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#38414e' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#212a37' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#746855' }]
          },
        ]
      };

      googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      // Add marker for current location
      const marker = new window.google.maps.Marker({
        position: { lat: currentLocation.lat, lng: currentLocation.lng },
        map: googleMapRef.current,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4F46E5',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        }
      });
      markersRef.current.push(marker);

      // Initialize directions renderer
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#8B5CF6',
          strokeWeight: 5
        }
      });

      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Map initialization error:', error);
      addNotification('❌ Failed to initialize map', 'error');
    }
  }, [mapReady, currentLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => {
        if (marker && marker.setMap) marker.setMap(null);
      });
      markersRef.current = [];
      
      if (directionsRendererRef.current && directionsRendererRef.current.setMap) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, []);

  // 🧭 Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          addNotification('📍 Location acquired', 'success');
        },
        (error) => {
          console.error('Location error:', error);
          addNotification('❌ Failed to get location', 'error');
        }
      );
    }
  }, []);

  // 🚗 Calculate Safe Route
  const calculateSafeRoute = async () => {
    if (!destination.trim()) {
      addNotification('Please enter a destination', 'warning');
      return;
    }

    setIsNavigating(true);

    try {
      const response = await fetch('http://localhost:5000/api/safe-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: currentLocation,
          destination: destination,
        }),
      });

      const data = await response.json();

      if (data.success && data.route) {
        setRoute(data.route);
        setSafetyScore(data.route.safetyScore || 75);
        addNotification('✅ Safe route calculated successfully', 'success');

        // Display route on map
        if (window.google && window.google.maps && directionsRendererRef.current && googleMapRef.current) {
          const directionsService = new window.google.maps.DirectionsService();
          
          directionsService.route(
            {
              origin: { lat: currentLocation.lat, lng: currentLocation.lng },
              destination: destination,
              travelMode: window.google.maps.TravelMode.WALKING
            },
            (result, status) => {
              if (status === 'OK') {
                directionsRendererRef.current.setDirections(result);
              } else {
                console.error('Directions request failed:', status);
              }
            }
          );
        }

        if (data.route.steps?.length > 0) {
          speakDirection(data.route.steps[0]);
        }
      } else {
        addNotification('⚠️ Could not retrieve route data', 'warning');
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      addNotification('❌ Failed to calculate route', 'error');
    } finally {
      setIsNavigating(false);
    }
  };

  // 🗣️ Speak navigation direction
  const speakDirection = (direction) => {
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(direction);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 🚨 Send SOS alert
  const sendSOSAlert = async () => {
    addNotification('🚨 Sending SOS alert...', 'warning');

    try {
      const response = await fetch('http://localhost:5000/api/emergency-sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: currentLocation,
          userId: 'user_123',
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification('✅ SOS alert sent successfully', 'success');
        speakDirection('SOS alert has been sent to your emergency contacts');
      }
    } catch (error) {
      console.error('SOS error:', error);
      addNotification('❌ Failed to send SOS alert', 'error');
    }
  };

  // 🧠 Safety color + label helpers
  const getSafetyColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSafetyLabel = (score) => {
    if (score >= 80) return 'Very Safe';
    if (score >= 60) return 'Moderately Safe';
    return 'Caution Advised';
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-2xl p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <Navigation className="w-6 h-6 mr-2 text-purple-400" />
          Safe Navigation Assistant
        </h2>

        {/* 🗺️ Google Maps Display */}
        <div className="mb-6 relative">
          <div className="w-full h-96 rounded-lg border-2 border-purple-400 overflow-hidden bg-slate-700">
            <div 
              ref={mapRef}
              className="w-full h-full"
            />
          </div>
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-700 rounded-lg">
              <div className="text-center">
                <Map className="w-16 h-16 text-purple-400 mx-auto mb-3 animate-pulse" />
                <p className="text-gray-300">Loading map...</p>
              </div>
            </div>
          )}
        </div>

        {/* 🌍 Current Location */}
        {currentLocation && (
          <div className="mb-6 p-4 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-400">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-blue-400 mt-1" />
              <div>
                <p className="text-white font-semibold mb-1">Current Location</p>
                <p className="text-sm text-gray-300">
                  Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 🏁 Destination Input */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Where do you want to go?
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter destination address"
              className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg border border-purple-400 focus:outline-none focus:border-purple-300"
            />
            <button
              onClick={calculateSafeRoute}
              disabled={isNavigating || !currentLocation}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Route className="w-5 h-5" />
              <span>{isNavigating ? 'Calculating...' : 'Navigate'}</span>
            </button>
          </div>
        </div>

        {/* 🧭 Route Display */}
        {route && (
          <div className="space-y-4 mb-6">
            {/* Route Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400 text-center">
                <p className="text-gray-400 text-sm mb-1">Distance</p>
                <p className="text-white text-xl font-bold">{route.distance}</p>
              </div>
              <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400 text-center">
                <p className="text-gray-400 text-sm mb-1">Duration</p>
                <p className="text-white text-xl font-bold">{route.duration}</p>
              </div>
              <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400 text-center">
                <p className="text-gray-400 text-sm mb-1">Safety</p>
                <p className={`text-xl font-bold ${getSafetyColor(safetyScore)}`}>
                  {safetyScore}%
                </p>
              </div>
            </div>

            {/* Safety Info */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-6 border-2 border-purple-400">
              <div className="text-center">
                <AlertTriangle className={`w-12 h-12 ${getSafetyColor(safetyScore)} mx-auto mb-3`} />
                <p className="text-gray-300 text-sm mb-2">Route Safety Assessment</p>
                <p className={`text-lg ${getSafetyColor(safetyScore)}`}>
                  {getSafetyLabel(safetyScore)}
                </p>
              </div>
            </div>

            {/* Step Directions */}
            <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400">
              <h3 className="text-white font-semibold mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-purple-400" />
                Turn-by-Turn Directions
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {route.steps?.map((step, idx) => (
                  <div key={`step-${idx}-${Date.now()}`} className="flex items-start space-x-3 p-3 bg-slate-600 bg-opacity-50 rounded">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-white">{step}</p>
                      <button
                        onClick={() => speakDirection(step)}
                        className="mt-2 text-sm text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Speak direction</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 🚨 SOS Section */}
        <div className="bg-red-900 bg-opacity-30 rounded-lg p-4 border-2 border-red-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-semibold">Emergency SOS</h3>
            </div>
          </div>

          <button
            onClick={sendSOSAlert}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center space-x-2"
          >
            <Phone className="w-5 h-5" />
            <span>SEND SOS ALERT</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NavigationAssist;