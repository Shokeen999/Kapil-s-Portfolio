import { PropsWithChildren } from "react";
import "./styles/Landing.css";

const Landing = ({ children }: PropsWithChildren) => {
  return (
    <>
      <div className="landing-section" id="landingDiv">
        <div className="landing-container">
          <div className="landing-intro">
            <h2>Hello! I'm</h2>
            <h1>
              KAPIL
              <br />
              <span>CHAUHAN</span>
            </h1>
          </div>
          <div className="landing-info">
            <h2 className="landing-info-h2">
              <div className="landing-h2-1">SENIOR</div>
              <div className="landing-h2-2">BI</div>
            </h2>
            <h2 className="landing-info-h2-title">
              <div className="landing-h2-info">ANALYST</div>
              <div className="landing-h2-info-1">SPECIALIST</div>
            </h2>
          </div>
        </div>
        {children}
      </div>
    </>
  );
};

export default Landing;

