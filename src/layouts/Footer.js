import "./Footer.css";
import { APP_VERSION } from "@/shared/appInfo";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer__divider" />
      <p className="app-footer__text">
        © {year} Development by <span className="app-footer__author">Santisuk</span>
        {APP_VERSION && <span className="app-footer__version">v{APP_VERSION}</span>}
      </p>
    </footer>
  );
};

export default Footer;
