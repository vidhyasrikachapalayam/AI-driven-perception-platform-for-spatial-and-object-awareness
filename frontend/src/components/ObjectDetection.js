import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Camera, Upload, Play, Square, AlertTriangle } from 'lucide-react';

function ObjectDetection({ addNotification }) {
  const [model, setModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState([]);
  const [imageSource, setImageSource] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const lastAnnouncementRef = useRef({ time: 0, objects: [] });

  // Load COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      setIsLoading(true);
      try {
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        addNotification('Object detection model loaded successfully', 'success');
      } catch (error) {
        console.error('Error loading model:', error);
        addNotification('Failed to load detection model', 'error');
      }
      setIsLoading(false);
    };
    
    loadModel();
  }, [addNotification]);

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setImageSource('webcam');
        addNotification('Camera started successfully', 'success');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      addNotification('Failed to access camera', 'error');
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsDetecting(false);
      setImageSource(null);
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      addNotification('Camera stopped', 'info');
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageSource('upload');
          if (videoRef.current) {
            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
          }
          detectObjects(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Smart announcement - only announce significant changes
  const announceDetections = useCallback((predictions) => {
    const now = Date.now();
    const lastAnnouncement = lastAnnouncementRef.current;
    
    // Only announce if:
    // 1. More than 3 seconds have passed since last announcement
    // 2. Objects have changed significantly
    if (now - lastAnnouncement.time < 3000) {
      return; // Too soon since last announcement
    }

    if (predictions.length === 0) {
      // Only announce "no objects" if we previously had objects
      // and 5 seconds have passed
      if (lastAnnouncement.objects.length > 0 && now - lastAnnouncement.time > 5000) {
        addNotification('No objects detected', 'info');
        lastAnnouncementRef.current = { time: now, objects: [] };
      }
      return;
    }

    // Get current object names
    const currentObjects = predictions.map(p => p.class).sort();
    const previousObjects = lastAnnouncement.objects.sort();

    // Check if objects changed significantly
    const objectsChanged = JSON.stringify(currentObjects) !== JSON.stringify(previousObjects);

    if (objectsChanged || now - lastAnnouncement.time > 8000) {
      // Announce only once
      const uniqueObjects = [...new Set(currentObjects)];
      const objectList = uniqueObjects.slice(0, 3).join(', ');
      const message = uniqueObjects.length > 3 
        ? `Detected: ${objectList} and ${uniqueObjects.length - 3} more`
        : `Detected: ${objectList}`;
      
      addNotification(message, 'success');
      
      // Check for hazards - announce only once
      const hazards = predictions.filter(p => 
        ['car', 'truck', 'bicycle', 'motorcycle', 'person'].includes(p.class)
      );
      
      if (hazards.length > 0 && !lastAnnouncement.objects.some(obj => 
        ['car', 'truck', 'bicycle', 'motorcycle', 'person'].includes(obj)
      )) {
        setTimeout(() => {
          addNotification(`Warning: ${hazards.length} moving object(s) nearby`, 'warning');
        }, 500);
      }

      lastAnnouncementRef.current = { time: now, objects: currentObjects };
    }
  }, [addNotification]);

  // Detect objects in image/video
  const detectObjects = useCallback(async (source) => {
    if (!model) {
      return;
    }

    try {
      const predictions = await model.detect(source);
      setDetections(predictions);
      
      // Draw bounding boxes
      drawPredictions(predictions, source);
      
      // Smart announcement
      announceDetections(predictions);
    } catch (error) {
      console.error('Detection error:', error);
    }
  }, [model, announceDetections]);

  // Draw bounding boxes on canvas
  const drawPredictions = (predictions, source) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    if (imageSource === 'webcam' && videoRef.current) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
    }
    
    // Draw boxes
    predictions.forEach(prediction => {
      const [x, y, width, height] = prediction.bbox;
      
      // Draw rectangle
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw label background
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(x, y - 25, width, 25);
      
      // Draw label text
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.fillText(
        `${prediction.class} ${Math.round(prediction.score * 100)}%`,
        x + 5,
        y - 7
      );
    });
  };

  // Continuous detection for webcam
  useEffect(() => {
    if (isDetecting && model && videoRef.current) {
      // Clear any existing interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      // Detect every 500ms instead of continuous
      detectionIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          detectObjects(videoRef.current);
        }
      }, 500);
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
  }, [isDetecting, model, detectObjects]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-2xl p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <Camera className="w-6 h-6 mr-2 text-purple-400" />
          Real-Time Object Detection
        </h2>
        
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading AI model...</p>
          </div>
        )}
        
        {!isLoading && (
          <>
            {/* Control Buttons */}
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
              
              {imageSource === 'webcam' && (
                <>
                  <button
                    onClick={() => setIsDetecting(!isDetecting)}
                    className={`flex items-center space-x-2 px-4 py-2 ${
                      isDetecting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    } text-white rounded-lg transition`}
                  >
                    {isDetecting ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isDetecting ? 'Stop Detection' : 'Start Detection'}</span>
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
            
            {/* Video/Canvas Display */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full ${imageSource === 'webcam' ? 'block' : 'hidden'}`}
              />
              
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              
              {!imageSource && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Select a source to start detection</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Detection Results */}
            {detections.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-yellow-400" />
                  Detected Objects ({detections.length})
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {detections.map((detection, index) => (
                    <div
                      key={index}
                      className="bg-slate-700 bg-opacity-50 rounded-lg p-3 border border-purple-400"
                    >
                      <p className="text-white font-semibold">{detection.class}</p>
                      <p className="text-sm text-gray-400">
                        Confidence: {Math.round(detection.score * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Position: ({Math.round(detection.bbox[0])}, {Math.round(detection.bbox[1])})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ObjectDetection;