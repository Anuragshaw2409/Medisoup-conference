import React, { useRef, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { types, Device } from "mediasoup-client";
import { params } from "./config";




// Parent component
function Meeting() {
  const { roomid, name } = useParams();
  const [roomId, setRoomId] = useState<string | undefined>(roomid);
  const [socket, setSocket] = useState<Socket>();
  const [device, setDevice] = useState<types.Device | null>(null);
  const [allProducers, setAllProducers] = useState<string[] | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localScreenRef = useRef<HTMLVideoElement | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  const [videoProducer, setVideoProducer] = useState<types.Producer | null>(null);
  const [audioproducer, setAudioProducer] = useState<types.Producer | null>(null);
  const [screenProducer, setScreenProducer] = useState<types.Producer | null>(null);

  const [producerIdWithKind, setProducerIdWithKind] = useState<Map<string, string>>(new Map());
  const [consumers, setConsumers] = useState<Map<string, types.Consumer>>(new Map());
  const [consumerTransports, setConsumerTransports] = useState<Map<string, types.Transport>>(new Map());
  
  // const consumerTransports = new Map();

  const [producerWithConsumer, setProducerWithConsumer] = useState<string[]>([])
  const [routerRTPCapabilities, setRouterRTPCapabilities] = useState<types.RtpCapabilities>();
  const remoteVideoContainer = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const audioRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLButtonElement | null>(null);
  const screenref = useRef<HTMLButtonElement | null>(null);

  const [audiotrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setvideoTrack] = useState<MediaStreamTrack | null>(null);
  const [screenTrack, setscreenTrack] = useState<MediaStreamTrack | null>(null);




  useEffect(() => {
    // connect to socket
    const socket = io('http://localhost:8000');
    setSocket(socket);

    // if there is room id try to connect to that room if valid
    if (roomId) {
      socket.emit('connect-room', { roomId, name }, (callback: any) => {
        if (callback.success) {
          setIsConnected(true);
        }
        else {
          console.log("Room does not exists");
          alert("Room does not exists");
          navigate(`/`);
        }
      });
    }
    //if no room id then send request to create a room
    else {
      socket.emit('create-room', { name }, (response: any) => {
        if (response.success) {
          console.log('connected to room', response.roomId);
          setRoomId(response.roomId);
          setIsConnected(true);
          navigate(`/meeting/${response.roomId}/${name}`, { replace: true });
        }
        else {
          console.log("Cannot connect to any room");
        }
      });

    }

  }, [])
  // ---------------------------connected to a room-------------------


  socket?.on('new-producer', ({ producerId }) => {
    if (!producerId) return;

    console.log("new producer", producerId);


    if (allProducers?.includes(producerId)) return;

    else {
      if (allProducers)
        setAllProducers([...allProducers, producerId]);
      else
        setAllProducers([producerId]);

    }

  });

  socket?.on('close-consumer',({producerId})=>{
    console.log("Close consumer event fired");
    
    setProducerWithConsumer(c=>{
      return c.filter((id)=>id!=producerId);
    });

    removeElements(producerId);

  })

  function removeElements(producerId:string){
    const consumer = consumers.get(producerId);
    const consumerTrans = consumerTransports.get(producerId);
    consumerTrans?.close();
    consumer?.close();

    setConsumerTransports(prev=>{
      const newMap = new Map(prev);
      newMap.delete(producerId);
      return newMap;
    })

    setConsumers(prev=>{
      const newConsumers = new Map(prev);
      newConsumers.delete(producerId);
      return newConsumers;
    });

    const element =document.getElementById(producerId);
   element?.remove();
  }

  useEffect(() => {
    if (isConnected) {
      getRTPCapabilityPromise();
      getAllProducers();

    }
  }, [isConnected])






  // -------------------get RTP Capabilities when connected to a room------------
  function getRTPCapabilityPromise() {

    socket?.emit("getRouterRPCapabilities", (callback: any) => {
      if (callback.success) {
        setRouterRTPCapabilities(callback.rtpCapabilities);
        console.log("getRouterRTP value: ", callback.rtpCapabilities);

      }
      else {
        alert(`cannot get RTP capabilities ${callback.message}`);
        return;
      }
    });

  }

  //---------------------get list of all producers in the room--------------------
  async function getAllProducers() {
    socket?.emit('get-producers', (callback: any) => {
      if (callback.success) {
        setAllProducers(callback.producers);
        console.log("All producers Values: ", callback.producers);
      }
    })

  }

  useEffect(() => {
    if (routerRTPCapabilities) {
      createDevice(routerRTPCapabilities);
    }
  }, [routerRTPCapabilities])


  //------------------------------create device after getting rtp of router-------------
  async function createDevice(params: any) {

    try {
      const device = new Device();
      setDevice(device);
      await device.load({
        routerRtpCapabilities: params
      });
      console.log("Device Created and Loaded: ", device);


    } catch (error) {
      alert(error);

    }
  }

  //--------------------get media device of user// call create transport and call produce on that transport---------------------------
  async function getUserMedia(type: string) {

    let stream: MediaStream | null = null;
    let mediaOptions: any;

    try {
      if (type == 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audio = stream.getAudioTracks()[0];
        setAudioTrack(audio);
        mediaOptions = { track: audio };

      }
      else if (type == 'video') {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: {
            width: {
              min: 640,
              ideal: 1920
            },
            height: {
              min: 400,
              ideal: 1080
            }
          }
        });
        const video = stream.getVideoTracks()[0];
        setvideoTrack(video);
        mediaOptions = { track: video, encodings: params.encodings, codecOptions: params.codecOptions };

      }
      else if (type == 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia();
        const screen = stream.getVideoTracks()[0];
        setscreenTrack(screen);
        mediaOptions = { track: screen };

      }
      if (!stream) return;

      if (type == 'video' && localVideoRef.current) {
        const element = document.getElementById('videoBox');
        element?.classList.remove('hidden');
        element?.classList.add('inline-block');

        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }
      if (type == 'screen' && localScreenRef.current) {
        const element = document.getElementById('screenBox');
        element?.classList.remove('hidden');
        element?.classList.add('inline-block');

        localScreenRef.current.srcObject = stream;
        localScreenRef.current.play();
      }

      createProducerTransport(type)
        .then((transport: any) => {
          produceMedia(transport, type, mediaOptions);
        })

    } catch (error) {
      alert(error);

    }


  }


  //------------------------when device gets loaded create a producer transport----------
  function createProducerTransport(type: string) {

    return new Promise((resolve, reject) => {

      try {

        socket?.emit('createWebRTCTransport', async (callback: any) => {
          if (callback.success) {
            const transportParams: types.TransportOptions = callback.params;
            const prodTransport = device?.createSendTransport({
              id: transportParams.id,
              iceParameters: transportParams.iceParameters,
              iceCandidates: transportParams.iceCandidates,
              dtlsParameters: transportParams.dtlsParameters
            });



            prodTransport?.on('connect', (params, callback, errback) => {
              try {

                socket.emit('connect-peer-transport', {
                  transportId: prodTransport.id,
                  dtlsParameters: params.dtlsParameters
                }, (callback: any) => {
                  console.log("PRoducer connected", callback);

                });
                callback();

              } catch (error: any) {
                alert(error)
                errback(error);

              }
            });

            prodTransport?.on('produce', ({ kind, rtpParameters }, callback, errback) => {

              try {
                socket.emit('produce', {
                  rtpParameters: rtpParameters,
                  kind,
                  transportId: prodTransport.id
                }, (({ producerId }: { producerId: any }) => {
                  
                  setProducerIdWithKind(prev=>{
                    const newMap = new Map(prev);
                    newMap.set(type,producerId);
                    return newMap;
                  });
                  callback(producerId);
                }))
              } catch (error: any) {
                alert(error);
                errback(error)
              }

            })

            resolve(prodTransport);
          }
        })

      } catch (error) {
        reject();
      }
    });

  }

  useEffect(() => {
    if (videoProducer) console.log(videoProducer.id);
  }, [videoProducer])



  //---------------------when producer tranport is made call produce to connect to server-------------
  async function produceMedia(transport: types.Transport, type: string, mediaOptions: types.AppData) {


    let producer: types.Producer;
    try {

      
      producer = await transport.produce(mediaOptions);
      
      
      producer?.on('trackended', () => {
        console.log("track ended");
      })
      
      producer?.on('transportclose', () => {
        console.log('transport ended')
        
        // close video track
      })
      if (!producer) return;
      type == "video" && setVideoProducer(producer);
      type == "audio" && setAudioProducer(producer);
      type == "screen" && setScreenProducer(producer);

      console.log("Producer made", producer.id);


    } catch (error) {
      console.log(error);


    }
  }


  useEffect(() => {
    if (allProducers) {

      allProducers.forEach(async (producer) => {
        createConsumerTransport(producer);
      })

    }

  }, [allProducers])


  async function createConsumerTransport(producer: string) {

    if (producerWithConsumer.includes(producer))
      return;

    socket?.emit('createWebRTCTransport', async (callback: any) => {
      if (callback.success) {
        const transportParams: types.TransportOptions = callback.params;
        const consTransport = device?.createRecvTransport({
          id: transportParams.id,
          iceParameters: transportParams.iceParameters,
          iceCandidates: transportParams.iceCandidates,
          dtlsParameters: transportParams.dtlsParameters
        });
        if(!consTransport)return;
        
        setConsumerTransports(prev=>{
          const newMap = new Map(prev);
          newMap.set(producer, consTransport);
          return newMap;
        })

        


        console.log("Consumer transport created:", consTransport);
        if (!consTransport) return;


        consTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log("Consumer transport connect called");
            socket.emit('connect-peer-transport', { dtlsParameters, transportId: consTransport.id }, (callback: any) => {
              console.log("consumer connected", callback);
            });
            callback();
          } catch (error: any) {
            errback(error);
            console.error("Error connecting consumer transport:", error);
          }
        });

        consumeProducer(consTransport, producer);
      } else {
        console.error("Cannot create consumer transport:", callback.message);
      }
    });
  }



  function consumeProducer(transportForConsumption: types.Transport, producer: string) {

    console.log("Consumer called for producer: ", producer, "device rtp: ", device?.rtpCapabilities);

    socket?.emit('consume',
      {
        rtpCapabilities: device?.rtpCapabilities,
        producerId: producer,
        transportId: transportForConsumption.id
      },
      async (callback: any) => {
        if (callback.success) {
          const params: types.ConsumerOptions = callback.params;
          if (!params) return;
          // const name = callback.name;
          console.log("params for calling consumer", params);
          try {

            const consumer = await transportForConsumption.consume({
              id: params.id,
              rtpParameters: params.rtpParameters,
              kind: params.kind,
              producerId: params.producerId

            });

            setConsumers(prev=>{
              const newMap = new Map(prev);
              newMap.set(producer, consumer);
              return newMap;
            });


            setProducerWithConsumer(c => [...c, consumer.producerId]);



            const { track } = consumer;
            
          
            

            if (consumer.kind == 'video') {
              if (remoteVideoContainer.current) {
                const newVideoElement = document.createElement('video');
                newVideoElement.id = consumer.producerId;
                newVideoElement.srcObject = new MediaStream([track]);
                newVideoElement.style.height = '110px';
                remoteVideoContainer.current.appendChild(newVideoElement);
                newVideoElement.play();


              }
            }
            else if (consumer.kind == 'audio') {
              const audioElement = document.createElement('audio');
              audioElement.id = consumer.producerId;
              audioElement.srcObject = new MediaStream([track]);
              audioElement.autoplay = true;
              audioElement.controls = false;
              document.append(audioElement);
            }
          } catch (error) {
            console.error("Error consuming producer:", error);
          }


          socket.emit('consumer-resume', { transportId: params.id }, (callback: any) => {
            console.log(callback);

          });


        }
        else {
          alert("Cannot consume producer");
        }

      })



  }




  function stopProducing(type: string) {

    socket?.emit('close-producer', { producerId: producerIdWithKind.get(type) })

    if (type == 'video' && videoTrack) {
      //emit to the socket to stop the prducing of the video
      videoProducer!.close();
      //stopping the track
      videoTrack.stop();
      setvideoTrack(null);

      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = null;
      }

      //removing the child
      const element = document.getElementById('videoBox');
      element?.classList.remove('inline-block');
      element?.classList.add('hidden');
    }


    else if (type == 'screen' && screenTrack) {
      screenProducer!.close();
      //stopping the track
      screenTrack.stop();
      setscreenTrack(null);

      if (localScreenRef.current && localScreenRef.current.srcObject) {
        localScreenRef.current.srcObject = null;
      }
      //removing the child
      const element = document.getElementById('screenBox');
      element?.classList.remove('inline-block');
      element?.classList.add('hidden');
    }
    else if (type == 'audio' && audiotrack) {
      audioproducer!.close();
      audiotrack.stop();
      setAudioTrack(null);
      //emit to stop audioproducer

    }

  }


  function handleVideoButton() {
    if (videoRef.current) {
      const value = videoRef.current.innerText;
      if (value == 'Start video' && !videoTrack) {
        videoRef.current.innerText = 'Stop video';
        getUserMedia('video');
      }
      else {
        videoRef.current.innerText = 'Start video';
        stopProducing('video');
      }
    }

  }

  function handleScreenButton() {
    if (screenref.current) {
      const value = screenref.current.innerText;
      if (value == 'Present screen' && !screenTrack) {
        screenref.current.innerText = 'Stop screen';
        getUserMedia('screen');
      }
      else {
        screenref.current.innerText = 'Present screen';
        stopProducing('screen');
      }

    }

  }

  function handleAudioButton() {
    if (audioRef.current) {
      const value = audioRef.current.innerText;
      if (value == 'Unmute' && !audiotrack) {
        audioRef.current.innerText = 'Mute';
        getUserMedia('audio');
      }
      else {
        audioRef.current.innerText = 'Unmute';
        stopProducing('audio');
      }

    }

  }










  return (
    <div className="relative w-full h-screen flex flex-col">

      <div className="flex h-[90%]">

        {/* localVideo */}
        <div className="localVideo  m-3 flex flex-col">
          <div className="w-auto h-auto hidden" id="videoBox">
            <VideoBox forwardedRef={localVideoRef} name={"You"} />
          </div>
          <div className="w-auto h-auto hidden" id="screenBox">
            <VideoBox forwardedRef={localScreenRef} name={"You"} />
          </div>
        </div>

        {/* Other Videos */}
        <div className="OtherVideos w-full  m-2 overflow-y-scroll flex flex-wrap gap-2 items-start" ref={remoteVideoContainer}>



        </div>

      </div>

      <div className="footer w-full border-t-[0.5px] border-slate-700 py-2 flex justify-center gap-x-3">
        <button className="py-2 px-4 border-2 border-red-500 text-red-500 rounded-lg" onClick={handleAudioButton} ref={audioRef}>
          Unmute

        </button>
        <button className="py-2 px-4 border-2 border-red-500 text-red-500 rounded-lg" onClick={handleVideoButton} ref={videoRef}>
          Start video
        </button>
        <button className="py-2 px-4 border-2 border-red-500 text-red-500 rounded-lg">
          End Call
        </button>
        <button className="py-2 px-4 border-2 border-red-500 text-red-500 rounded-lg" onClick={handleScreenButton} ref={screenref}>
          Present screen
        </button>
      </div>
    </div>
  );
}

export default Meeting;













function VideoBox({ forwardedRef, name }: { forwardedRef: React.RefObject<HTMLVideoElement>, name: string }) {


  return (
    <div className="h-40 w-60 rounded-lg border-2 overflow-clip relative group " >
      <video ref={forwardedRef} className="w-full h-full bg-black object-cover"></video>
      <h2 className="absolute bottom-0 pl-3 group-hover:bg-gradient-to-b from-transparent to-slate-700 w-full">{name}</h2>
    </div>
  );
}
