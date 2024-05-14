import React from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <div className="container my-5">
      <footer
    
              className="text-center text-lg-start text-dark"
              style={{backgroundColor: "#ECEFF1"}}
              >
  
        <div
             className="text-center p-3"
            //  style={{backgroundColor: "rgba(0, 0, 0, 0.2)"}}
             >
          © 2024 Develop By Sanyisuk
          {/* <Link className="text-dark" href="https://mdbootstrap.com/"
             >MDBootstrap.com</Link> */}
        </div>
      </footer>
    </div>
  )
}

export default Footer
