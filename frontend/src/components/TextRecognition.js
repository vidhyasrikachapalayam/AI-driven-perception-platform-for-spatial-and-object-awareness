import React, { useState, useRef, useEffect, useCallback } from "react";
import Tesseract from "tesseract.js";
import { Camera, Upload, Play, Square, FileText } from "lucide-react";

function TextRecognition({ addNotification }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [imageSource, setImageSource] = useState(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // --- Start webcam ---
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setImageSource("webcam");
        addNotification("Camera started successfully", "success");
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
      addNotification("Failed to access camera", "error");
    }
  };

  // --- Stop webcam ---
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsDetecting(false);
      setImageSource(null);
      setRecognizedText("");
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      addNotification("Camera stopped", "info");
    }
  };

  // --- Handle image upload ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageSource("upload");
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          recognizeTextFromCanvas();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Recognize text from canvas ---
  const recognizeTextFromCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsLoading(true);
      setProgress(0);
      const result = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = result.data.text.trim();
      setRecognizedText(text);
      if (text.length > 0) {
        addNotification(`Recognized text: "${text.slice(0, 50)}..."`, "success");
      } else {
        addNotification("No readable text detected", "info");
      }
    } catch (error) {
      console.error("OCR error:", error);
      addNotification("Error during text recognition", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  // --- Continuous recognition (for webcam) ---
  useEffect(() => {
    if (isDetecting && imageSource === "webcam" && videoRef.current) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      detectionIntervalRef.current = setInterval(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (video && video.readyState === 4) {
          const ctx = canvas.getContext("2d");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          recognizeTextFromCanvas();
        }
      }, 4000); // every 4 seconds to reduce CPU load
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isDetecting, imageSource, recognizeTextFromCanvas]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-2xl p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-purple-400" />
          Real-Time Text Recognition
        </h2>

        {isLoading && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-3"></div>
            <p className="text-gray-300">Analyzing text... ({progress}%)</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          {!imageSource && (
            <>
              <button
                onClick={startWebcam}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Image</span>
              </button>
            </>
          )}

          {imageSource === "webcam" && (
            <>
              <button
                onClick={() => setIsDetecting(!isDetecting)}
                className={`flex items-center space-x-2 px-4 py-2 ${
                  isDetecting
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                } text-white rounded-lg transition`}
              >
                {isDetecting ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{isDetecting ? "Stop Recognition" : "Start Recognition"}</span>
              </button>

              <button
                onClick={stopWebcam}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
              >
                <Square className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Video / Canvas Display */}
        <div
          className="relative bg-black rounded-lg overflow-hidden"
          style={{ minHeight: "400px" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full ${imageSource === "webcam" ? "block" : "hidden"}`}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />
          {!imageSource && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  Select a source to start text recognition
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recognized Text */}
        {recognizedText && (
          <div className="mt-6 bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400">
            <h3 className="text-lg font-semibold text-white mb-2">Recognized Text</h3>
            <pre className="text-gray-300 whitespace-pre-wrap">
              {recognizedText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default TextRecognition;
