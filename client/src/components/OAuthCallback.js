import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function OAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userString = params.get('user');

    if (accessToken && refreshToken && userString) {
      try {
        const user = JSON.parse(decodeURIComponent(userString));
        
        // Store tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        // Call onLogin callback
        onLogin(user);

        // Redirect to home
        navigate('/');
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/?error=oauth_failed');
      }
    } else {
      // Missing parameters
      navigate('/?error=oauth_incomplete');
    }
  }, [location, navigate, onLogin]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h2>Completing sign in...</h2>
        <p style={{ color: '#666' }}>Please wait while we log you in.</p>
      </div>
    </div>
  );
}

export default OAuthCallback;
