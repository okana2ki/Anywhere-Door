
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import Door from './components/Door';
import ImageView from './components/ImageView';
import type { AppState } from './types';
import { DOKODEMO_DOOR, TAKECOPTER, HONYAKU_KONNYAKU } from './constants';
import MicIcon from './components/MicIcon';

// Add type definitions for the Web Speech API.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    // FIX: Add webkitAudioContext to window type for cross-browser compatibility.
    webkitAudioContext: typeof AudioContext;
  }
}

// Audio decoding functions for TTS
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [statusMessage, setStatusMessage] = useState('冒険の準備はいい？');
  const [recognizedText, setRecognizedText] = useState('');
  const [finalLocation, setFinalLocation] = useState('');
  const [isDoorOpen, setIsDoorOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [aerialImages, setAerialImages] = useState<string[]>([]);
  const [currentAerialImageIndex, setCurrentAerialImageIndex] = useState(0);
  const [textToTranslate, setTextToTranslate] = useState('');
  const [translatedText, setTranslatedText] = useState('');


  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const appStateRef = useRef(appState);
  const audioContextRef = useRef<AudioContext | null>(null);
  appStateRef.current = appState;

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  }, []);

  useEffect(() => {
    const activeListeningStates: AppState[] = ['READY', 'AWAITING_LOCATION', 'IMAGE_DISPLAYED', 'AWAITING_TRANSLATION_INPUT'];
    if (!activeListeningStates.includes(appState)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAppState('ERROR');
      setStatusMessage('お使いのブラウザは音声認識に対応していません。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      const cleanedTranscript = finalTranscript.trim().replace(/[.。,、]$/, '');
      if (!cleanedTranscript) return;

      setRecognizedText(cleanedTranscript);
      const currentState = appStateRef.current;

      switch (currentState) {
        case 'READY':
          if (cleanedTranscript.includes(DOKODEMO_DOOR)) {
            setStatusMessage('どこへ行きたい？');
            setAppState('AWAITING_LOCATION');
          }
          break;
        case 'AWAITING_LOCATION':
          if (cleanedTranscript.includes(DOKODEMO_DOOR)) {
            return; 
          }
          setFinalLocation(cleanedTranscript);
          setStatusMessage(`「${cleanedTranscript}」だね！ちょっと待ってね...`);
          setAppState('GENERATING_IMAGE');
          break;
        case 'IMAGE_DISPLAYED':
          if (cleanedTranscript.includes(TAKECOPTER)) {
            setStatusMessage('タケコプター！高度を上げていくよ！');
            setAppState('GENERATING_AERIAL_IMAGES');
          } else if (cleanedTranscript.includes(HONYAKU_KONNYAKU)) {
            setStatusMessage('翻訳こんにゃく！何を翻訳する？');
            setAppState('AWAITING_TRANSLATION_INPUT');
          }
          break;
        case 'AWAITING_TRANSLATION_INPUT':
            if (cleanedTranscript.includes(HONYAKU_KONNYAKU)) return;
            setTextToTranslate(cleanedTranscript);
            setStatusMessage(`「${cleanedTranscript}」を翻訳中...`);
            setAppState('TRANSLATING');
            break;
        default:
          break;
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setAppState('ERROR');
            setStatusMessage('マイクの使用が許可されていません。');
        }
    };

    recognition.onend = () => {
        const currentState = appStateRef.current;
        if (activeListeningStates.includes(currentState)) {
            console.log("Recognition service ended, restarting...");
            startListening();
        }
    };
    
    recognitionRef.current = recognition;
    startListening();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [appState, startListening]);

  useEffect(() => {
    if (appState !== 'GENERATING_IMAGE' || !finalLocation) return;

    const generateImage = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: `A beautiful photorealistic image of ${finalLocation}. Vertical portrait.`,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '9:16',
          },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
          const generatedImageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
          
          setImageUrl(generatedImageUrl);
          setStatusMessage(`「${finalLocation}」に到着！「タケコプター」か「翻訳こんにゃく」と言ってみて！`);
          setAppState('IMAGE_DISPLAYED');
          setIsDoorOpen(true);
        } else {
          throw new Error("No images were generated.");
        }
      } catch (error) {
        console.error("Error generating image:", error);
        if (error instanceof Error && (error.message.includes('"code":429') || error.message.includes('"status":"RESOURCE_EXHAUSTED"'))) {
          setStatusMessage('APIの利用が集中しています。少し待ってからもう一度試してね。');
        } else {
          setStatusMessage('画像の生成に失敗しました。もう一度試してね。');
        }
        setAppState('ERROR');
      }
    };

    generateImage();
  }, [appState, finalLocation]);

  useEffect(() => {
    if (appState !== 'GENERATING_AERIAL_IMAGES' || !finalLocation || !imageUrl) return;

    const generateAerialImages = async () => {
      try {
        setStatusMessage('ぐんぐん上昇中...');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompts = [
          `A low altitude aerial view of ${finalLocation}. Photorealistic. Vertical portrait.`,
          `A high altitude satellite view of ${finalLocation}. Photorealistic. Vertical portrait.`
        ];
        
        const generatedUrls: string[] = [];
        for (const prompt of prompts) {
          const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '9:16',
            },
          });

          if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            generatedUrls.push(`data:image/jpeg;base64,${base64ImageBytes}`);
          } else {
            throw new Error(`Failed to generate an aerial image for prompt: ${prompt}`);
          }
          // Add a 1-second delay between requests to avoid rate limiting.
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setAerialImages([imageUrl, ...generatedUrls]);
        setCurrentAerialImageIndex(0);
        setAppState('AERIAL_IMAGES_DISPLAYED');
        setStatusMessage('上空からの景色だよ！');

      } catch (error) {
        console.error("Error generating aerial images:", error);
        if (error instanceof Error && (error.message.includes('"code":429') || error.message.includes('"status":"RESOURCE_EXHAUSTED"'))) {
          setStatusMessage('APIの利用が集中しています。少し待ってからもう一度試してね。');
        } else {
          setStatusMessage('画像の生成に失敗しました。');
        }
        setAppState('ERROR');
      }
    };

    generateAerialImages();
  }, [appState, finalLocation, imageUrl]);

  useEffect(() => {
    if (appState !== 'TRANSLATING' || !textToTranslate || !finalLocation) return;

    const translateAndSpeak = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const translationPrompt = `Translate the following Japanese phrase into the primary language spoken in ${finalLocation}. The phrase is: "${textToTranslate}". Please only provide the translated text as your response. If you cannot determine a primary language for the location, please respond with the exact phrase "NO_LANGUAGE_FOUND".`;
        const translationResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: translationPrompt,
        });
        const translated = translationResponse.text.trim();

        if (translated === 'NO_LANGUAGE_FOUND') {
          setStatusMessage(`ごめんなさい、「${finalLocation}」で話されている言葉がわかりませんでした。`);
          setTimeout(() => {
            setStatusMessage(`「タケコプター」か「翻訳こんにゃく」と言ってみて！`);
            setAppState('IMAGE_DISPLAYED');
            setTextToTranslate('');
            setTranslatedText('');
          }, 4000);
          return;
        }
        
        if (!translated) {
          throw new Error("Translation resulted in empty text, which is invalid for the speech synthesis API.");
        }

        setTranslatedText(translated);
        setStatusMessage(`翻訳結果: ${translated}`);

        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: translated }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
          }
          const audioContext = audioContextRef.current;
          const audioBuffer = await decodeAudioData(
              decode(base64Audio),
              audioContext,
              24000,
              1,
          );
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start();
          source.onended = () => {
              setStatusMessage(`「タケコプター」か「翻訳こんにゃく」と言ってみて！`);
              setAppState('IMAGE_DISPLAYED');
              setTextToTranslate('');
              setTranslatedText('');
          };
        } else {
           throw new Error("No audio data was generated.");
        }

      } catch (error) {
        console.error("Error during translation or speech synthesis:", error);
        setStatusMessage('翻訳または音声の生成に失敗しました。もう一度試してね。');
        setAppState('ERROR');
      }
    };

    translateAndSpeak();
  }, [appState, textToTranslate, finalLocation]);
  
  // Effect for slideshow progression
  useEffect(() => {
    if (appState !== 'AERIAL_IMAGES_DISPLAYED' || aerialImages.length <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentAerialImageIndex(prevIndex => (prevIndex + 1) % aerialImages.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [appState, aerialImages]);


  const handleStart = async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setAppState('READY');
        setStatusMessage('マイクに向かって「どこでもドア」と言ってね');
    } catch (err) {
        console.error("Microphone access error:", err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
             setAppState('ERROR');
             setStatusMessage('マイクへのアクセスが拒否されました。');
        } else {
             setAppState('ERROR');
             setStatusMessage('開始できませんでした。もう一度お試しください。');
        }
    }
  };

  const handleReset = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    audioContextRef.current = null;

    setAppState('IDLE');
    setStatusMessage('冒険の準備はいい？');
    setRecognizedText('');
    setFinalLocation('');
    setIsDoorOpen(false);
    setImageUrl('');
    setAerialImages([]);
    setCurrentAerialImageIndex(0);
    setTextToTranslate('');
    setTranslatedText('');
  }

  const isListening = ['READY', 'AWAITING_LOCATION', 'IMAGE_DISPLAYED', 'AWAITING_TRANSLATION_INPUT'].includes(appState);
  const showResetButton = ['IMAGE_DISPLAYED', 'AERIAL_IMAGES_DISPLAYED', 'ERROR'].includes(appState);
  const isLoading = ['GENERATING_IMAGE', 'GENERATING_AERIAL_IMAGES', 'TRANSLATING'].includes(appState);

  const currentImageUrl = appState === 'AERIAL_IMAGES_DISPLAYED' ? aerialImages[currentAerialImageIndex] : imageUrl;
  const shouldRotateImage = appState === 'AERIAL_IMAGES_DISPLAYED' && aerialImages.length > 0 && currentAerialImageIndex === aerialImages.length - 1;

  return (
    <div className="w-full h-screen overflow-hidden bg-gradient-to-b from-sky-400 to-sky-200 flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full p-6 text-center z-20 flex flex-col items-center">
        <div className="bg-black/50 rounded-xl p-4 inline-block shadow-lg">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            どこでもドア
          </h1>
          <p className="text-white text-lg mt-2 font-bold min-h-[3.5rem] flex items-center justify-center" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
            {statusMessage}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center text-center">
        {appState === 'IDLE' && (
          <div className="flex flex-col items-center">
            <button
              onClick={handleStart}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transform hover:scale-105 transition-transform duration-200 ease-in-out"
            >
              ぼうけんをはじめる！
            </button>
          </div>
        )}

        {appState !== 'IDLE' && appState !== 'ERROR' && (
          <Door isOpen={isDoorOpen}>
             {(currentImageUrl || isLoading) && <ImageView url={currentImageUrl} isRotating={shouldRotateImage} />}
            
            {isLoading && (
              <div className="absolute inset-0 w-full h-full bg-black/50 flex items-center justify-center z-10">
                <div className="w-16 h-16 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
              </div>
            )}
          </Door>
        )}
        
        {showResetButton && appState !== 'ERROR' && (
            <div className="mt-8 relative z-30">
                <button
                    onClick={handleReset}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full text-lg shadow-lg transform hover:scale-105 transition-transform duration-200 ease-in-out"
                >
                    もう一度！
                </button>
            </div>
        )}

        {appState === 'ERROR' && (
          <div className="bg-white/70 p-8 rounded-xl shadow-2xl text-center max-w-sm">
              <p className="text-red-600 font-bold text-xl">{statusMessage}</p>
              <p className="text-gray-700 mt-2">もう一度試すには下のボタンを押してください。</p>
               <button
                    onClick={handleReset}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full text-lg shadow-lg transform hover:scale-105 transition-transform duration-200 ease-in-out"
                >
                    もう一度！
                </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col items-center justify-center z-20">
        {isListening && <MicIcon isListening={isListening} />}
        <div className="mt-2 h-6 flex items-center justify-center">
          {recognizedText && (
            <p className="text-white text-md font-semibold bg-black/50 rounded-full px-3 py-1" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
              {recognizedText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
