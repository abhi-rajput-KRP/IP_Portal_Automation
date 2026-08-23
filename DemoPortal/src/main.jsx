import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from "react-router";
import './index.css'
import Login from './components/Login.jsx';
import Students from './components/Students.jsx';
import Sems from './components/Sems.jsx';
import Logout from "./components/logout.jsx"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/sems",
    element: <Sems />,
  },
  {
    path: "/students",
    element: <Students />,
  }
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
