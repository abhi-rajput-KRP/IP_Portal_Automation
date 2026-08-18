import { useState } from 'react';
import { useNavigate } from 'react-router';

export default function Login() {
  const [email , setemail] = useState("");
  const [password , setpassword] = useState("");
  const navigate = useNavigate()

  async function HandelSubmit(e){
    e.preventDefault();
    console.log(`Email = ${email} and Password = ${password}`);
    navigate("/sems");
  }

  return (
    <div className='h-screen flex justify-center items-center'>
    <div className="max-w-md p-20 relative flex flex-col rounded-md text-black bg-white border  border-gray-400">
      <div className="text-2xl font-bold mb-2 text-[#1e0e4b] text-center">Welcome back to <span className="text-[#7747ff]">Portal</span></div>
      <div className="text-sm font-normal mb-4 text-center text-[#1e0e4b]">Log in to your account</div>
      <form onSubmit={(e) => HandelSubmit(e)} className="flex flex-col gap-3">
        <div className="block relative"> 
          <label htmlFor="email" className="block text-gray-600 cursor-text text-sm leading-[140%] font-normal mb-2">Email</label>
          <input type="text" id="email" className="rounded border border-gray-200 text-sm w-full font-normal leading-[18px] text-black tracking-[0px] appearance-none block h-11 m-0 p-[11px] focus:ring-2 ring-offset-2 ring-gray-900 outline-0" 
          value={email}
          onChange={(e) => setemail(e.target.value)}
          />
        </div>
        <div className="block relative"> 
          <label htmlFor="password" className="block text-gray-600 cursor-text text-sm leading-[140%] font-normal mb-2">Password</label>
          <input type="text" id="password" className="rounded border border-gray-200 text-sm w-full font-normal leading-[18px] text-black tracking-[0px] appearance-none block h-11 m-0 p-[11px] focus:ring-2 ring-offset-2 ring-gray-900 outline-0" 
          value={password}
          onChange={(e)=>setpassword(e.target.value)}/>
        </div>
        <button type="submit" className="bg-[#7747ff] w-max m-auto px-6 py-2 rounded text-white text-sm font-normal cursor-pointer">Submit</button>
      </form>
    </div>
    </div>
  );
}
