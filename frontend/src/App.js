import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Navigation, AlertCircle, Eye, Volume2, Wifi } from 'lucide-react';

// Import components
import ObjectDetection from './components/ObjectDetection';
import TextRecognition from './components/TextRecognition';
import FaceRecognition from './components/FaceRecognition';
import CurrencyRecognition from './components/CurrencyRecognition';
import NavigationAssist from './components/NavigationAssist';
import VoiceCommands from './components/VoiceCommands';

function App() {
  const [activeModule, setActiveModule] = useState('home');
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [notifications, setNotifications] = useState([]);

  // Speech synthesis for feedback
  const speak = useCallback((text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Add notification
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    speak(message);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, [speak]);

  useEffect(() => {
    // Check backend connection
    fetch('http://localhost:5000/')
      .then(res => res.json())
      .then(() => setConnectionStatus('connected'))
      .catch(() => setConnectionStatus('disconnected'));
  }, []);

  const renderModule = () => {
    switch(activeModule) {
      case 'detection':
        return <ObjectDetection addNotification={addNotification} />;
      case 'text':
        return <TextRecognition addNotification={addNotification} />;
      case 'face':
        return <FaceRecognition addNotification={addNotification} />;
      case 'currency':
        return <CurrencyRecognition addNotification={addNotification} />;
      case 'navigation':
        return <NavigationAssist addNotification={addNotification} />;
      default:
        return <HomeScreen setActiveModule={setActiveModule} speak={speak} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black bg-opacity-50 backdrop-blur-lg border-b border-purple-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Eye className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">VisionAssist AR</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              } bg-opacity-20`}>
                <Wifi className={`w-4 h-4 ${
                  connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
                }`} />
                <span className={`text-sm ${
                  connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {connectionStatus}
                </span>
              </div>
              
              {activeModule !== 'home' && (
                <button
                  onClick={() => {
                    setActiveModule('home');
                    speak('Returning to home screen');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  Home
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-lg border ${
              notif.type === 'success' ? 'bg-green-500 border-green-400' :
              notif.type === 'warning' ? 'bg-yellow-500 border-yellow-400' :
              notif.type === 'error' ? 'bg-red-500 border-red-400' :
              'bg-blue-500 border-blue-400'
            } bg-opacity-90 text-white animate-slide-in`}
          >
            <p className="text-sm font-medium">{notif.message}</p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {renderModule()}
      </main>

      {/* Voice Command Button (Global) */}
      <VoiceCommands 
        setActiveModule={setActiveModule} 
        addNotification={addNotification}
        speak={speak}
      />
    </div>
  );
}

// Home Screen Component
function HomeScreen({ setActiveModule, speak }) {
  const modules = [
    { 
      id: 'detection', 
      name: 'Object Detection', 
      icon: Eye, 
      color: 'from-blue-500 to-blue-700',
      description: 'Detect and identify objects in real-time'
    },
    { 
      id: 'text', 
      name: 'Text Reader', 
      icon: Volume2, 
      color: 'from-green-500 to-green-700',
      description: 'Read text from images and documents'
    },
    { 
      id: 'face', 
      name: 'Face Recognition', 
      icon: Camera, 
      color: 'from-purple-500 to-purple-700',
      description: 'Recognize familiar faces'
    },
    { 
      id: 'currency', 
      name: 'Currency ID', 
      icon: AlertCircle, 
      color: 'from-yellow-500 to-yellow-700',
      description: 'Identify currency denominations'
    },
    { 
      id: 'navigation', 
      name: 'Safe Navigation', 
      icon: Navigation, 
      color: 'from-red-500 to-red-700',
      description: 'Get safe route guidance'
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white mb-4">
          Welcome to VisionAssist AR
        </h2>
        <p className="text-gray-300 text-lg">
          Your intelligent companion for safe navigation and environmental awareness
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => {
                setActiveModule(module.id);
                speak(`Opening ${module.name}`);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 border border-purple-500 hover:border-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              
              <div className="relative z-10">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">
                  {module.name}
                </h3>
                
                <p className="text-gray-400 text-sm">
                  {module.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-lg p-4 border border-purple-500">
          <p className="text-gray-400 text-sm">Objects Detected Today</p>
          <p className="text-3xl font-bold text-white">127</p>
        </div>
        <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-lg p-4 border border-purple-500">
          <p className="text-gray-400 text-sm">Text Read</p>
          <p className="text-3xl font-bold text-white">43</p>
        </div>
        <div className="bg-slate-800 bg-opacity-50 backdrop-blur-lg rounded-lg p-4 border border-purple-500">
          <p className="text-gray-400 text-sm">Safe Routes</p>
          <p className="text-3xl font-bold text-white">8</p>
        </div>
      </div>
    </div>
  );
}

export default App;