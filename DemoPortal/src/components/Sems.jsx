import { checklogin } from "../firebase";
import { Link, useNavigate } from "react-router";
import { useEffect,useState } from "react";
import Loader from "./loader";

export default function Sems() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if(!checklogin()){
            navigate('/');
        } else{
            setLoading(false);
        }
    }, [navigate]);

    if (loading) {
    return <Loader/>;
  }
    let sem = [1, 3, 5, 7]
    return (
        <div className='h-screen flex justify-center items-center gap-1.5'>
            {sem.map((a) => (
                <div key={a} className="max-w-md p-15 relative flex flex-col gap-1.5 rounded-md text-black bg-white border  border-gray-400">
                    <div className="text-2xl font-bold mb-2 text-[#1e0e4b] text-center">Semster <span className="text-[#7747ff]">{a}</span></div>
                    <Link to={`/students?sem=${a}`} className="bg-[#7747ff] w-max m-auto px-6 py-2 rounded text-white font-normal cursor-pointer">Select</Link>
                </div>
            ))}
        </div>
    );
}