

export default function Students() {
    let sem = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11,12,13,14,15,16,17,18,19,20]
    return (
        <div className='h-screen flex flex-col justify-center items-center gap-1.5'>
            <div className="relative m-5 overflow-x-auto bg-neutral-primary-soft shadow-xs rounded-base border border-default">
                <table className="w-[60vw] text-sm text-left rtl:text-right text-body">
                    <thead className="text-sm text-body bg-neutral-secondary-soft border-b rounded-base border-default">
                        <tr>
                            <th scope="col" className="px-6 py-3 font-medium">
                                S.No
                            </th>
                            <th scope="col" className="px-6 py-3 font-medium">
                                Semester
                            </th>
                            <th scope="col" className="px-6 py-3 font-medium">
                                Enlorrment Number
                            </th>
                            <th scope="col" className="px-6 py-3 font-medium">
                                Name
                            </th>
                            <th scope="col" className="px-6 py-3 font-medium">
                                Marks Alloted
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sem.map((a) => (
                            <tr key={a} className="bg-neutral-primary border-b border-default">
                                <th scope="row" className="px-6 font-medium text-heading whitespace-nowrap">
                                    {a}
                                </th>
                                <td className="px-6 py-0.5">
                                    3
                                </td>
                                <td className="px-6 py-0.5">
                                    11219051625
                                </td>
                                <td className="px-6 py-0.5">
                                    Abhi Rajput
                                </td>
                                <td className="px-6 py-0.5">
                                    <input type="number" className="border rounded p-3 inputf" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}