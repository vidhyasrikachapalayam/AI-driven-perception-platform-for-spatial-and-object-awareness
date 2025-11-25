import React, { useState, useRef } from 'react';
import { DollarSign, Camera, Upload, Volume2 } from 'lucide-react';

function CurrencyRecognition({ addNotification }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [detectedCurrency, setDetectedCurrency] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Simulated currency detection (in real app, use CNN model)
  const currencyDatabase = [
    { value: 10, color: 'brown', keywords: ['ten', 'reserve bank'] },
    { value: 20, color: 'orange', keywords: ['twenty', 'reserve bank'] },
    { value: 50, color: 'purple', keywords: ['fifty', 'reserve bank'] },
    { value: 100, color: 'blue', keywords: ['hundred', 'reserve bank'] },
    { value: 200, color: 'yellow', keywords: ['two hundred', 'reserve bank'] },
    { value: 500, color: 'green', keywords: ['five hundred', 'reserve bank'] },
    { value: 2000, color: 'pink', keywords: ['two thousand', 'reserve bank'] },
  ];

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        addNotification('Camera started', 'success');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      addNotification('Failed to access camera', 'error');
    }
  };

  // Capture from webcam
  const captureFromWebcam = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    const imageSrc = canvas.toDataURL('image/png');
    setImagePreview(imageSrc);
    
    // Stop webcam after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    detectCurrency(imageSrc);
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target.result;
        setImagePreview(imageSrc);
        detectCurrency(imageSrc);
      };
      reader.readAsDataURL(file);
    }
  };

  // Simulate currency detection
  // inside CurrencyRecognition.js

const detectCurrency = async (imageSrc) => {
  setIsProcessing(true);
  setDetectedCurrency(null);

  try {
    // Convert base64 image to file
    const blob = await fetch(imageSrc).then((res) => res.blob());
    const formData = new FormData();
    formData.append("image", blob, "currency.png");

    // Send to backend
    const response = await fetch("http://localhost:5000/api/detect-objects", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) throw new Error(result.error || "Detection failed");

    // --- Simulated currency detection (as before) ---
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const randomCurrency = currencyDatabase[Math.floor(Math.random() * currencyDatabase.length)];
    const simulatedConfidence = 85 + Math.random() * 15;

    setDetectedCurrency(randomCurrency);
    setConfidence(Math.round(simulatedConfidence));

    const message = `Detected: ${randomCurrency.value} Rupee note with ${Math.round(simulatedConfidence)}% confidence`;
    addNotification(message, "success");

    // Call backend TTS (optional)
    await fetch("http://localhost:5000/api/text-to-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    // Browser speech
    speakCurrency(randomCurrency.value);
  } catch (error) {
    console.error("Detection error:", error);
    addNotification("Failed to detect currency", "error");
  } finally {
    setIsProcessing(false);
  }
};


  // Speak currency value
  const speakCurrency = (value) => {
    const utterance = new SpeechSynthesisUtterance(`${value} rupees`);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Repeat announcement
  const repeatAnnouncement = () => {
    if (detectedCurrency) {
      speakCurrency(detectedCurrency.value);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-2xl p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <DollarSign className="w-6 h-6 mr-2 text-purple-400" />
          Currency Recognition
        </h2>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            disabled={isProcessing}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Image</span>
          </button>

          <button
            onClick={streamRef.current ? captureFromWebcam : startWebcam}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            disabled={isProcessing}
          >
            <Camera className="w-4 h-4" />
            <span>{streamRef.current ? 'Capture' : 'Use Camera'}</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Webcam Preview */}
        {streamRef.current && (
          <div className="mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg"
            />
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-6">
            <img
              src={imagePreview}
              alt="Currency"
              className="w-full rounded-lg border border-purple-400"
            />
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Analyzing currency note...</p>
          </div>
        )}

        {/* Detection Result */}
        {detectedCurrency && !isProcessing && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg p-6 border-2 border-green-400">
              <div className="text-center">
                <DollarSign className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <p className="text-gray-300 text-lg mb-2">Detected Denomination</p>
                <p className="text-5xl font-bold text-white mb-2">
                  ₹{detectedCurrency.value}
                </p>
                <p className="text-green-300 text-sm">
                  Confidence: {confidence}%
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-green-600">
                <p className="text-green-200 text-sm">
                  <strong>Color:</strong> {detectedCurrency.color}
                </p>
                <p className="text-green-200 text-sm mt-1">
                  <strong>Currency:</strong> Indian Rupee (INR)
                </p>
              </div>

              <button
                onClick={repeatAnnouncement}
                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                <Volume2 className="w-5 h-5" />
                <span>Repeat Announcement</span>
              </button>
            </div>

            {/* Confidence Meter */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Detection Confidence</span>
                <span className="text-white font-semibold">{confidence}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    confidence >= 90 ? 'bg-green-500' :
                    confidence >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${confidence}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {!imagePreview && !isProcessing && (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Upload a currency note or use camera to identify</p>
            <p className="text-sm text-gray-500 mt-2">
              Supports Indian Rupee notes: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000
            </p>
          </div>
        )}

        {/* Supported Currencies Info */}
        <div className="mt-6 p-4 bg-slate-700 bg-opacity-30 rounded-lg">
          <h3 className="text-white font-semibold mb-3">Supported Denominations</h3>
          <div className="grid grid-cols-4 gap-2">
            {currencyDatabase.map((curr) => (
              <div
                key={curr.value}
                className="text-center p-2 bg-slate-600 bg-opacity-50 rounded"
              >
                <p className="text-white font-bold">₹{curr.value}</p>
                <p className="text-xs text-gray-400">{curr.color}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CurrencyRecognition;