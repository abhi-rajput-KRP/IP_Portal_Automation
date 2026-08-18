

export default function Sems() {
    let sem = [1, 3, 5, 7]
    return (
        <div className='h-screen flex justify-center items-center gap-1.5'>
            {sem.map((a) => (
                <div key={a} className="max-w-md p-15 relative flex flex-col gap-1.5 rounded-md text-black bg-white border  border-gray-400">
                    <div className="text-2xl font-bold mb-2 text-[#1e0e4b] text-center">Semster <span className="text-[#7747ff]">{a}</span></div>
                    <button className="bg-[#7747ff] w-max m-auto px-6 py-2 rounded text-white font-normal cursor-pointer">Select</button>
                </div>
            ))}
        </div>
    );
}