import { useState } from "react";
import { useNavigate } from "react-router-dom"

function Login() {
    const navigate = useNavigate();
    const [roomName, setRoomName] = useState("");
    const [name, setName] = useState("");
    const [err, setErr] = useState("");

    function handleExistingRoomJoin() {
        if (roomName.length == 0) {
            setErr("Enter room name");
            return;
        }
        if(name.length==0){
            setErr("Enter a name");
            return;
        }

        navigate(`/meeting/${roomName}/${name}`);
    }
    function handleRoomCreation() {
        if(name.length==0){
            setErr("Enter a name");
            return;
        }

        navigate(`/meeting/${name}`);
    }

    return (
        <div className="w-full h-screen flex justify-center items-center relative">
            <div className="navbar w-full top-0 left-0  absolute flex items-start p-2">
                <h1 className="text-3xl font-thin text-cyan-400">Next-Gen Meets (MediaSoup Demo)</h1>


            </div>

            <div className="flex w-full justify-center gap-x-3">
                <button className="p-2 rounded-md bg-blue-800 hover:bg-blue-900" onClick={handleRoomCreation}>Create Instant Meeting</button>

                <div className="w-[0.5px] bg-slate-400">
                </div>

                <div className=" gap-x-2 flex h-10">
                    <input type="text" placeholder="Enter room id" className="p-2 rounded-md text-white bg-transparent border-2 border-slate-600" onChange={(e) => { setRoomName(e.target.value) }} />
                    <input type="text" placeholder="Enter name" className="p-2 rounded-md text-white bg-transparent border-2 border-slate-600" onChange={(e) => { setName(e.target.value) }} />
                    <button className="py-2 px-4 border-2 border-green-500 text-green-500 rounded-md" onClick={handleExistingRoomJoin}>Join</button>
                    <h2 className="w-full text-center text-red-600">{err}</h2>

                </div>

            </div>
        </div>
    )
}

export default Login
