import React from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
      <footer
    
              className="text-center text-lg-start text-dark my-5"
              style={{backgroundColor: "#f8f9fa"}}
              >
  
        <div
             className="text-center p-3"
            //  style={{backgroundColor: "rgba(0, 0, 0, 0.2)"}}
             >
          © 2024 Develop By Santisuk
          {/* <Link className="text-dark" href="https://mdbootstrap.com/"
             >MDBootstrap.com</Link> */}
        </div>
      </footer>
  )
}

export default Footer
