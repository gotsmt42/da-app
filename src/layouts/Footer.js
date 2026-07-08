import "./Footer.css";

const version = process.env.REACT_APP_VERSION;

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer__divider" />
      <p className="app-footer__text">
        © {year} Development by <a href="" rel="noopener noreferrer">Santisuk</a>
        {version && <span className="app-footer__version">v{version}</span>}
      </p>
    </footer>
  );
};

export default Footer;
