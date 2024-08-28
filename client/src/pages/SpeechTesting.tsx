import { useEffect, useState } from "react";
import useSpeechToText from "../hooks/useSpeechToText"

function SpeechTesting() {

    const [text, setText] = useState("");
    const options = {
        interimResults: true,
        // lang : "en-US",
        continuous:true
    }
    const {isListening, transcript, starListening, stopListening} = useSpeechToText(options);
    function startStopListening(){
        isListening? stopListening():starListening();
    }

    useEffect(()=>{
        const interval = setInterval(()=>{
            setText(transcript);
        },1000);
        return()=>{
            clearInterval(interval);
        }

    },[transcript])
  

  return (
    <div>
        <button className="w-10 h-10 bg-blue-200" onClick={startStopListening}>{isListening?"off":"on"}</button>
      <textarea name="speechToText" id="" value={text} className="text-black h-96 w-96" readOnly>
        
      </textarea>
    </div>
  )
}

export default SpeechTesting
