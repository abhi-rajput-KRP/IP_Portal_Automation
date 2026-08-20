import { logout } from "../firebase";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function Logout() {
    const navigate = useNavigate();
    
    useEffect(() => {
        logout();
        navigate('/');
    }, []);
    return (
        <></>
    );
}