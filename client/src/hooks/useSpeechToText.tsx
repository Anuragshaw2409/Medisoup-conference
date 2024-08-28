import { useEffect, useRef, useState } from "react"

interface SpeechRecognitionType extends EventTarget {
  interimResults: boolean;
  lang: string;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
  // Add other properties and methods as needed
}
declare global {
  interface Window {
    webkitSpeechRecognition: {
      new(): SpeechRecognitionType;
    };
  }
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}








function useSpeechToText(options: any) {
  const userInputeRef = useRef<boolean>(false);
  const reRenderRef = useRef<number>();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error("Web speech api is not supported");
      return;

    }

    recognitionRef.current = new (window as any).webkitSpeechRecognition() as SpeechRecognitionType;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.interimResults = options.interimResults || true;
    //  recognition.lang = options.lang || "en-US";
    recognition.continuous = options.continuous || false;

    recognition.onresult = (e) => {
      // console.log("on Rsult called", e.results);

      // let text = "";
      

      for (let i = 0; i < e.results.length; i++) {
        // const text = e.results[i][0] ;

        setTranscript(e.results[i][0].transcript);
      }
    }

    recognition.onerror = () => {
      // console.error("Speech recognition error", e.error);
      if (userInputeRef.current) {
        recognitionRef.current?.stop();
        // recognitionRef.current?.start();
        setIsListening(false);
        setTranscript("");
      }


    }

    recognition.onend = () => {
      console.log("Ended");
      setIsListening(false);
      setTranscript("");

      console.log("USerinput", userInputeRef.current);
      
      if (userInputeRef.current) {
        recognitionRef.current?.stop();
        recognitionRef.current?.start();
        setIsListening(true);
        setTranscript('');
      }

    }

    return () => {
      recognition.stop();

    }


  }, [])

  const starListening = () => {
    if (recognitionRef.current && !isListening) {
      console.log("started listening");

      userInputeRef.current=true;
      recognitionRef.current.start();
      setIsListening(true);
      setTranscript("");
      console.log("user input", userInputeRef.current);
      
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      console.log("Stopped listening");

      userInputeRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }

  useEffect(()=>{
    console.log("User Input in use Effect",userInputeRef.current);
    
  },[userInputeRef.current])





  return ({
    isListening,
    transcript,
    starListening,
    stopListening,
    // setUserInput
  })
}

export default useSpeechToText
