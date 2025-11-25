import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { User, Camera, UserPlus, Users, Play, Square, RefreshCw } from 'lucide-react';

function FaceRecognition({ addNotification }) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [labeledDescriptors, setLabeledDescriptors] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face-api models...');
        console.log('TensorFlow.js version:', await import('@tensorflow/tfjs').then(tf => tf.version.tfjs));
        
        const MODEL_URL = '/models';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(`${MODEL_URL}/tiny_face_detector`);
        console.log('✓ Tiny Face Detector loaded');
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(`${MODEL_URL}/face_landmark_68`);
        console.log('✓ Face Landmark 68 loaded');
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(`${MODEL_URL}/face_recognition`);
        console.log('✓ Face Recognition loaded');
        
        await faceapi.nets.faceExpressionNet.loadFromUri(`${MODEL_URL}/face_expression`);
        console.log('✓ Face Expression loaded');
        
        setModelsLoaded(true);
        addNotification('✅ Face recognition models loaded successfully', 'success');
      } catch (error) {
        console.error('❌ Error loading models:', error);
        console.error('Error details:', error.message);
        addNotification(`❌ Failed to load models: ${error.message}`, 'error');
      }
    };

    loadModels();
    loadRegisteredFaces();
  }, []);

  // Load registered faces from server
  const loadRegisteredFaces = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/faces?userId=default_user');
      const data = await response.json();

      if (data.success) {
        setRegisteredFaces(data.faces);
        addNotification(`📋 Loaded ${data.faces.length} registered faces`, 'success');
        
        // Load descriptors for recognition
        await loadFaceDescriptors();
      }
    } catch (error) {
      console.error('Error loading faces:', error);
      addNotification('❌ Failed to load registered faces', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load face descriptors for matching
  const loadFaceDescriptors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/faces/descriptors?userId=default_user');
      const data = await response.json();

      if (data.success && data.faces.length > 0) {
        const labeledDescriptors = data.faces.map(face => {
          const descriptors = [new Float32Array(face.descriptor)];
          return new faceapi.LabeledFaceDescriptors(face.name, descriptors);
        });

        setLabeledDescriptors(labeledDescriptors);
        
        // Create face matcher
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        setFaceMatcher(matcher);
        
        console.log('Face matcher initialized with', labeledDescriptors.length, 'faces');
      }
    } catch (error) {
      console.error('Error loading descriptors:', error);
    }
  };

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        addNotification('📷 Camera started', 'success');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      addNotification('❌ Failed to access camera', 'error');
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsDetecting(false);
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      addNotification('📷 Camera stopped', 'info');
    }
  };

  // Detect and recognize faces
  const detectFaces = async () => {
    if (!videoRef.current || !modelsLoaded || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const displaySize = {
      width: video.videoWidth,
      height: video.videoHeight
    };

    faceapi.matchDimensions(canvas, displaySize);

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions();

      if (detections.length > 0) {
        setDetectedFaces(detections);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // Draw detections
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        // Recognize faces if matcher is available
        if (faceMatcher) {
          resizedDetections.forEach((detection, i) => {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            
            // Draw label
            const box = detection.detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, {
              label: bestMatch.toString(),
              boxColor: bestMatch.label === 'unknown' ? '#ff0000' : '#00ff00'
            });
            drawBox.draw(canvas);
          });
        } else {
          faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        }
      } else {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  // Start continuous detection
  const startDetection = () => {
    setIsDetecting(true);
    detectFaces();
    detectionIntervalRef.current = setInterval(detectFaces, 100);
  };

  // Stop detection
  const stopDetection = () => {
    setIsDetecting(false);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
  };

  // Register new face to database
  const registerFace = async () => {
    if (!newPersonName.trim()) {
      addNotification('⚠️ Please enter a name', 'warning');
      return;
    }

    if (!videoRef.current || !modelsLoaded) {
      addNotification('⚠️ Camera not ready', 'warning');
      return;
    }

    setIsLoading(true);
    addNotification('📸 Capturing face...', 'info');

    try {
      const video = videoRef.current;
      
      // Perform a fresh detection to capture current face
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        addNotification('⚠️ No face detected. Please position your face clearly in the camera.', 'warning');
        setIsLoading(false);
        return;
      }

      // Get face descriptor
      const faceDescriptor = Array.from(detection.descriptor);

      const response = await fetch('http://localhost:5000/api/faces/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonName,
          faceDescriptor: faceDescriptor,
          userId: 'default_user'
        }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification(`✅ ${newPersonName} registered successfully`, 'success');
        setNewPersonName('');
        setRegistrationMode(false);
        
        // Reload faces and descriptors
        await loadRegisteredFaces();
      } else {
        addNotification('❌ Failed to register face', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      addNotification('❌ Failed to register face', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete registered face
  const deleteFace = async (id) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/faces/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        addNotification('✅ Person removed', 'success');
        await loadRegisteredFaces();
      } else {
        addNotification('❌ Failed to remove person', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      addNotification('❌ Failed to remove person', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-2xl p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <User className="w-6 h-6 mr-2 text-purple-400" />
          Face Recognition System
        </h2>

        {!modelsLoaded && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading face recognition models...</p>
          </div>
        )}

        {modelsLoaded && (
          <>
            {/* Control Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              {!streamRef.current ? (
                <button
                  onClick={startWebcam}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={isDetecting ? stopDetection : startDetection}
                    className={`flex items-center space-x-2 px-4 py-2 ${
                      isDetecting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    } text-white rounded-lg transition`}
                  >
                    {isDetecting ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isDetecting ? 'Stop Detection' : 'Start Detection'}</span>
                  </button>

                  <button
                    onClick={() => setRegistrationMode(!registrationMode)}
                    disabled={isLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{registrationMode ? 'Cancel' : 'Register Face'}</span>
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

              <button
                onClick={loadRegisteredFaces}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 ml-auto"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Registration Form */}
            {registrationMode && (
              <div className="mb-6 p-4 bg-purple-900 bg-opacity-30 rounded-lg border border-purple-400">
                <h3 className="text-white font-semibold mb-3">Register New Person</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="Enter person's name"
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg border border-purple-400 focus:outline-none focus:border-purple-300"
                    disabled={isLoading}
                  />
                  <button
                    onClick={registerFace}
                    disabled={isLoading}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : 'Register'}
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  👀 Look directly at the camera, ensure good lighting, and click Register
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Tip: Face should be clearly visible and well-lit for best results
                </p>
              </div>
            )}

            {/* Video Preview */}
            <div className="relative bg-black rounded-lg overflow-hidden mb-6" style={{ minHeight: '400px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                onLoadedMetadata={() => {
                  if (canvasRef.current && videoRef.current) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                  }
                }}
              />
              
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />

              {!streamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Start camera to detect faces</p>
                  </div>
                </div>
              )}

              {/* Live Status Badge */}
              {isDetecting && (
                <div className="absolute top-4 right-4 px-3 py-1 bg-red-600 text-white rounded-full text-sm flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              )}
            </div>

            {/* Detection Info */}
            {detectedFaces.length > 0 && isDetecting && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">
                  🔍 Detected: {detectedFaces.length} face(s)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {detectedFaces.map((face, index) => {
                    const expressions = face.expressions.asSortedArray();
                    return (
                      <div
                        key={index}
                        className="bg-slate-700 bg-opacity-50 rounded-lg p-3 border border-purple-400"
                      >
                        <p className="text-white font-semibold">Face #{index + 1}</p>
                        <p className="text-sm text-gray-400">
                          {expressions[0].expression}: {Math.round(expressions[0].probability * 100)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Registered Faces */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-400" />
                Registered Persons ({registeredFaces.length})
              </h3>

              {registeredFaces.length === 0 ? (
                <div className="text-center py-8 bg-slate-700 bg-opacity-30 rounded-lg">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No registered faces yet</p>
                  <p className="text-sm text-gray-500 mt-2">Register your first person to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {registeredFaces.map((person) => (
                    <div
                      key={person.id}
                      className="bg-slate-700 bg-opacity-50 rounded-lg p-4 border border-purple-400 flex justify-between items-center"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{person.name}</p>
                          <p className="text-sm text-gray-400">
                            {new Date(person.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteFace(person.id)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FaceRecognition;