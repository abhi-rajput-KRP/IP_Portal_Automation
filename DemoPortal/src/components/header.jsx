import { logout } from "../firebase";
import { useNavigate } from "react-router";

export default function Header_comp(){
    const navigate = useNavigate();
    return(
        <header className="h-[15vh] p-4 bg-[#7747ff]-20 border-b-0.5 text-coolGray-800 w-full">
                <div className="container flex justify-between h-16 mx-auto">
                    <h1 className="text-3xl font-bold text-center">Marks Portal</h1>
                    <div className="items-center shrink-0 lg:flex">
                        <button onClick={()=>{
                            logout();
                            navigate("/");
                        }} className="self-center px-8 py-3 font-semibold rounded bg-[#7747ff] text-white cursor-pointer">
                            Logout
                        </button>
                    </div>
                </div>
            </header>
    );
}