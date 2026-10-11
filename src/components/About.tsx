import "./styles/About.css";

const About = () => {
  return (
    <div className="about-section" id="about">
      <div className="about-me">
        <h3 className="title">About Me</h3>
        <p className="para">
          Senior Analyst with 5+ years of experience delivering 60+ automated dashboards and BI pipelines across fintech, FMCG, e-commerce, and BPO sectors.
        </p>
        <div className="about-stats">
          <div className="about-stat-item">
            <h4>5+</h4>
            <span>Years Experience</span>
          </div>
          <div className="about-stat-item">
            <h4>60+</h4>
            <span>Dashboards Delivered</span>
          </div>
          <div className="about-stat-item">
            <h4>97%</h4>
            <span>Reporting Time Cut</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
