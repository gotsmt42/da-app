import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const apiUrl = process.env.REACT_APP_API_URL;

const CheckConnection = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const response = await fetch(`${apiUrl}`);
        if (response.status === 503) {
          // If the server is unavailable (HTTP 503), set hasError to true
          setHasError(true);
        } else if (response.status === 200) {
          // If everything is fine (HTTP 200), set hasError to false
          setHasError(false);
        }
      } catch (error) {
        console.error('Error checking connectivity:', error);
        // If there's a fetch error (e.g., network issue), consider it an error
        setHasError(true);
      }
    };

    checkConnectivity();

    // Set up interval to check connectivity periodically
    const intervalId = setInterval(checkConnectivity, 5000); // Check every 5 seconds

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (hasError) {
      navigate('/noconnection');
    }
  }, [hasError, navigate]);

  if (hasError) {
    
    navigate('/noconnection');  }

  return children;
};

export default CheckConnection;
