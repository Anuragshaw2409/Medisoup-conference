import './App.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/Login'
import Meeting from './pages/Meeting'
import Layout from './pages/Layout'
import SpeechTesting from './pages/SpeechTesting'

function App() {
  const router = createBrowserRouter([
    {
      path:'/',
      element:<Layout/>,
      children:[
        {
          path:'/',
          element:<Login/>
        },
        {
          path:'/meeting/:name',
          element:<Meeting/>
        },
        {
          path:'/meeting/:roomid/:name',
          element:<Meeting/>
        },
        {
          path:'/speech',
          element:<SpeechTesting/>
        }

      ]
    }
   
  ])

  return (
    <>
      

      <RouterProvider router={router}/>
    </>
  )
}

export default App
