import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const apiUrl = process.env.REACT_APP_API_URL;

const NoConnection = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const response = await fetch(`${apiUrl}`);
        if (response.ok) {
          // If the connection is back, navigate to the home page
          console.log('Connection is back, navigating to the home page.');
          navigate('/');
        } else if (response.status === 503) {
          console.warn('Service unavailable, still no connection.');
        } else {
          console.warn('Unexpected response status:', response.status);
        }
      } catch (error) {
        console.error('Still no connection:', error.message);
      }
    };

    // Set up interval to check connectivity periodically
    const intervalId = setInterval(checkConnectivity, 5000); // Check every 5 seconds

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [navigate]);

  return (
    <div>
      <h1>ไม่มีการเชื่อมต่อ Internet</h1>
      <p>โปรดตรวจสอบการเชื่อมต่อของคุณและลองใหม่อีกครั้ง...</p>
      <span><Link to='/'>Refresh</Link></span>
    </div>
  );
};

export default NoConnection;
