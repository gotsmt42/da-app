
import "./index.css";

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./assets/scss/style.scss";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter as Router } from "react-router-dom";
import Loader from "./layouts/loader/Loader";

import { AuthProvider } from "./auth/AuthContext";

import { StyleSheetManager } from "styled-components";

import "bootstrap/dist/css/bootstrap.min.css"; // import Bootstrap CSS

import "@fortawesome/react-fontawesome"



const root = ReactDOM.createRoot(document.getElementById("root"));



root.render(
  
  <React.StrictMode>
    
    <Suspense fallback={<Loader />}>
      <Router>
        <AuthProvider>
          <StyleSheetManager shouldForwardProp={(prop) => prop !== "align"}>
            <App />

          </StyleSheetManager>
        </AuthProvider>
      </Router>
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
