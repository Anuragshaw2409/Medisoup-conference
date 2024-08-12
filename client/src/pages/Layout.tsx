import { Outlet } from "react-router-dom"

function Layout() {
  return (
    <>
    <div className="absolute top-0 z-[-2] h-auto w-full bg-neutral-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
        <Outlet/>
    </div>
      
    </>
  )
}

export default Layout
