import { getItems, checklogin, updateStudentMarks,logout } from "../firebase";
import { useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import Loader from "./loader";
import Header_comp from "./header";
import * as XLSX from 'xlsx';


export default function Students() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const sem = Number(searchParams.get('sem'));
    useEffect(() => {
        checklogin().then((resp) => {
            if (!resp) {
                navigate("/");
            }
        })
    }, [navigate]);
    const [students, setstudents] = useState([])

    useEffect(() => {
        let items = getItems(sem);
        items.then((data) => {
            console.log("Fetched data from database");
            setstudents(data);
            setLoading(false);
        });
    }, [])

    function HandelSubmit() {
        students.map((data) => {
            // console.log(data.id, data.marks);
            if (Number(data.marks) !== 0) {
                updateStudentMarks(data.id, data.marks);
            }
        });
        alert("All marks uploaded !!")
    }

    function ExportData() {
        const table = document.getElementById('content-table');
        const rows = table.querySelectorAll('tr');
        const data = [];

        rows.forEach((row) => {
            const rowData = [];
            const cells = row.querySelectorAll('th, td');

            cells.forEach((cell) => {
                // Check for input, select, or textarea inside the cell
                const input = cell.querySelector('input, select, textarea');

                if (input) {
                    // Convert numeric inputs to numbers, otherwise keep as string
                    const val = input.value;
                    const num = Number(val);
                    rowData.push(val !== '' && !isNaN(num) ? num : val);
                }
                else {
                    rowData.push(cell.innerText.trim());
                }
            });

            data.push(rowData);
        });

        // 1. Create a worksheet from the 2D array
        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // 2. Create a new workbook and attach the sheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

        // 3. Trigger download
        XLSX.writeFile(workbook, 'exported_table.xlsx');
    }

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="h-screen">
            {<Header_comp />}
            <div className='h-[85vh] flex flex-col justify-center items-center md:gap-1.5'>
                <div className="relative m-0.5 overflow-x-auto bg-neutral-primary-soft rounded border border-default">
                    <table id="content-table" className="md:w-[90vw] w-1.5 text-sm text-left rtl:text-right text-body">
                        <thead className="text-sm text-body bg-neutral-secondary-soft border-b rounded-base border-default">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-medium hidden sm:table-cell">
                                    S.No
                                </th>
                                <th scope="col" className="px-6 py-3 font-medium hidden sm:table-cell">
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
                            {students.map((data, index) => (
                                <tr key={index} className="bg-neutral-primary border-b border-default">
                                    <td className="px-6 py-0.5 hidden sm:table-cell">
                                        {index + 1}
                                    </td>
                                    <td className="px-6 py-0.5 hidden sm:table-cell ">
                                        {data.sem}
                                    </td>
                                    <td className="px-6 py-0.5">
                                        {data.enrollment_no}
                                    </td>
                                    <td className="px-6 py-0.5">
                                        {data.name}
                                    </td>
                                    <td className="px-6 py-0.5">
                                        <input type="number" id={data.enrollment_no} className="border rounded p-3 inputf"
                                            value={data.marks}
                                            min="0"
                                            max="40"
                                            onChange={(e) => {
                                                const updatedValue = e.target.value;
                                                setstudents((prevStudents) =>
                                                    prevStudents.map((item, i) =>
                                                        i === index ? { ...item, marks: updatedValue } : item
                                                    )
                                                );
                                            }} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={HandelSubmit} className="bg-[#7747ff] w-max mb-2 px-6 py-2 rounded text-white text-sm font-normal cursor-pointer">Submit</button>
                <button id="export-btn" className="bg-[#7747ff] w-max mb-2 px-6 py-2 rounded text-white text-sm font-normal cursor-pointer" onClick={ExportData}>Export to Excel</button>
            </div>
        </div>
    );
}