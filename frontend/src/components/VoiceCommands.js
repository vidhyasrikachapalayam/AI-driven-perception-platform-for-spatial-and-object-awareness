import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

function VoiceCommands({ setActiveModule, addNotification, speak }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        speak('Listening for commands');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        
        setTranscript(transcriptText);

        // Only process final results
        if (event.results[current].isFinal) {
          processCommand(transcriptText.toLowerCase().trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          addNotification('Voice recognition error', 'error');
        }
      };

      recognitionRef.current = recognition;
    } else {
      addNotification('Speech recognition not supported in this browser', 'error');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Process voice command
  const processCommand = (command) => {
    console.log('Processing command:', command);

    // Command mappings
    const commands = {
      // Navigation
      'go home': () => {
        setActiveModule('home');
        speak('Going to home screen');
      },
      'home': () => {
        setActiveModule('home');
        speak('Going to home screen');
      },
      
      // Module activation
      'detect objects': () => {
        setActiveModule('detection');
        speak('Opening object detection');
      },
      'object detection': () => {
        setActiveModule('detection');
        speak('Opening object detection');
      },
      'read text': () => {
        setActiveModule('text');
        speak('Opening text reader');
      },
      'text reader': () => {
        setActiveModule('text');
        speak('Opening text reader');
      },
      'recognize face': () => {
        setActiveModule('face');
        speak('Opening face recognition');
      },
      'face recognition': () => {
        setActiveModule('face');
        speak('Opening face recognition');
      },
      'identify currency': () => {
        setActiveModule('currency');
        speak('Opening currency identification');
      },
      'currency': () => {
        setActiveModule('currency');
        speak('Opening currency identification');
      },
      'navigate': () => {
        setActiveModule('navigation');
        speak('Opening navigation');
      },
      'navigation': () => {
        setActiveModule('navigation');
        speak('Opening navigation');
      },

      // Help
      'help': () => {
        speak('Available commands: go home, detect objects, read text, recognize face, identify currency, navigate, or send SOS');
      },
      'what can you do': () => {
        speak('I can detect objects, read text, recognize faces, identify currency, and provide safe navigation');
      },

      // Emergency
      'send sos': () => {
        addNotification('SOS Alert Triggered', 'warning');
        speak('Sending SOS alert to emergency contacts');
      },
      'emergency': () => {
        addNotification('Emergency Mode Activated', 'warning');
        speak('Emergency mode activated. Say send SOS to alert contacts');
      },
    };

    // Find matching command
    let commandExecuted = false;
    for (const [key, action] of Object.entries(commands)) {
      if (command.includes(key)) {
        action();
        commandExecuted = true;
        break;
      }
    }

    if (!commandExecuted) {
      speak('Command not recognized. Say help for available commands');
    }

    // Clear transcript after processing
    setTimeout(() => setTranscript(''), 3000);
  };

  // Toggle listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      addNotification('Speech recognition not available', 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      addNotification('Voice commands stopped', 'info');
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        addNotification('Failed to start voice recognition', 'error');
      }
    }
  };

  return (
    <>
      {/* Floating Voice Button */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 ${
          isListening
            ? 'bg-red-600 hover:bg-red-700 animate-pulse'
            : 'bg-purple-600 hover:bg-purple-700'
        }`}
        title={isListening ? 'Stop listening' : 'Start voice commands'}
      >
        {isListening ? (
          <MicOff className="w-8 h-8 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Transcript Display */}
      {transcript && (
        <div className="fixed bottom-28 right-8 max-w-xs bg-slate-800 bg-opacity-95 backdrop-blur-lg rounded-lg p-4 shadow-2xl border border-purple-500 z-50 animate-slide-in">
          <p className="text-sm text-gray-400 mb-1">You said:</p>
          <p className="text-white font-medium">{transcript}</p>
        </div>
      )}

      {/* Voice Commands Help */}
      {isListening && (
        <div className="fixed bottom-28 left-8 max-w-sm bg-slate-800 bg-opacity-95 backdrop-blur-lg rounded-lg p-4 shadow-2xl border border-purple-500 z-50">
          <h3 className="text-white font-semibold mb-3">Available Commands:</h3>
          <div className="space-y-1 text-sm text-gray-300">
            <p>• "Go home" - Return to home screen</p>
            <p>• "Detect objects" - Open object detection</p>
            <p>• "Read text" - Open text reader</p>
            <p>• "Recognize face" - Open face recognition</p>
            <p>• "Identify currency" - Open currency ID</p>
            <p>• "Navigate" - Open navigation</p>
            <p>• "Send SOS" - Emergency alert</p>
            <p>• "Help" - Hear all commands</p>
          </div>
        </div>
      )}
    </>
  );
}

export default VoiceCommands;