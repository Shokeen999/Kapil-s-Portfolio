import { MdArrowOutward, MdCopyright } from "react-icons/md";
import "./styles/Contact.css";

const Contact = () => {
  return (
    <div className="contact-section section-container" id="contact">
      <div className="contact-container">
        <h3>Contact</h3>
        <div className="contact-flex">
          <div className="contact-box">
            <h4>Email</h4>
            <p>
              <a href="mailto:Kapilchauhan924@gmail.com" data-cursor="disable">
                Kapilchauhan924@gmail.com
              </a>
            </p>
            <h4>Phone</h4>
            <p>
              <a href="tel:+919071041333" data-cursor="disable">
                +91 9071041333
              </a>
            </p>
            <h4>Location</h4>
            <p>
              <span>New Delhi, India</span>
            </p>
          </div>
          <div className="contact-box">
            <h4>Connect</h4>
            <a
              href="mailto:Kapilchauhan924@gmail.com"
              data-cursor="disable"
              className="contact-social"
            >
              Email <MdArrowOutward />
            </a>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              data-cursor="disable"
              className="contact-social"
            >
              LinkedIn <MdArrowOutward />
            </a>
            <a
              href="tel:+919071041333"
              data-cursor="disable"
              className="contact-social"
            >
              WhatsApp / Call <MdArrowOutward />
            </a>
          </div>
          <div className="contact-box">
            <h2>
              Senior Analyst <br /> <span>Kapil Chauhan</span>
            </h2>
            <h5>
              <MdCopyright /> 2026
            </h5>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
