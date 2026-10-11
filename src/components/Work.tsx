import "./styles/Work.css";
import WorkImage from "./WorkImage";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const projects = [
  {
    num: "01",
    name: "Automated WBR System",
    category: "Razorpay • FinTech Automation",
    tools: "Google Sheets, Apps Script, 8-Team Data Consolidation (2.5h → 5min)",
    image: "/images/project1.jpg",
  },
  {
    num: "02",
    name: "Executive Power BI Suite",
    category: "Razorpay • Business Intelligence",
    tools: "Power BI, DAX, Power Query, Automated Email Pipeline",
    image: "/images/project2.jpg",
  },
  {
    num: "03",
    name: "WFM Shrinkage & Productivity",
    category: "Ienergizer • Operations Analytics",
    tools: "Advanced Excel, VBA Macros, Shrinkage & Productivity Models",
    image: "/images/project3.jpg",
  },
  {
    num: "04",
    name: "Multi-Process MIS Pipeline",
    category: "Ienergizer • Process Leadership",
    tools: "Power BI, Data Pipelines, 7 Processes, 6 Analysts Led",
    image: "/images/project4.jpg",
  },
  {
    num: "05",
    name: "CEO Executive Scorecard",
    category: "Mattlooks • Financial Analytics",
    tools: "Advanced Excel, Financial Consolidation, C-Level KPIs",
    image: "/images/project5.jpg",
  },
  {
    num: "06",
    name: "Supply Chain & Sales BI",
    category: "HealthKart & Varun Beverages • FMCG",
    tools: "Power BI, Sales & Inventory Visibility, Standardized Scorecards",
    image: "/images/project6.jpg",
  },
];

const Work = () => {
  useGSAP(() => {
    const workFlex = document.querySelector(".work-flex") as HTMLElement;
    if (!workFlex) return;

    function getScrollDistance() {
      const lastBox = workFlex.querySelector(".work-box:last-child") as HTMLElement;
      if (!lastBox) return 2200;
      const currentX = (gsap.getProperty(workFlex, "x") as number) || 0;
      const lastBoxRect = lastBox.getBoundingClientRect();
      const naturalRight = lastBoxRect.right - currentX;
      const paddingRight = window.innerWidth <= 1400 ? 60 : 120;
      return Math.max(0, naturalRight - window.innerWidth + paddingRight);
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".work-section",
        start: "top top",
        end: () => "+=" + getScrollDistance(),
        scrub: 1,
        pin: true,
        pinSpacing: true,
        id: "work",
      },
    });

    timeline.to(".work-flex", {
      x: () => -getScrollDistance(),
      ease: "none",
    });

    const refreshLayout = () => {
      ScrollTrigger.refresh();
    };

    const images = workFlex.querySelectorAll("img");
    images.forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", refreshLayout);
    });

    const timer1 = setTimeout(refreshLayout, 300);
    const timer2 = setTimeout(refreshLayout, 800);

    window.addEventListener("resize", refreshLayout);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("resize", refreshLayout);
      timeline.kill();
      ScrollTrigger.getById("work")?.kill();
    };
  }, []);

  return (
    <div className="work-section" id="work">
      <div className="work-container section-container">
        <h2>
          Featured <span>Projects</span>
        </h2>
        <div className="work-flex">
          {projects.map((project, index) => (
            <div className="work-box" key={index}>
              <div className="work-info">
                <div className="work-title">
                  <h3>{project.num}</h3>

                  <div>
                    <h4>{project.name}</h4>
                    <p>{project.category}</p>
                  </div>
                </div>
                <h4>Tools and impact</h4>
                <p>{project.tools}</p>
              </div>
              <WorkImage image={project.image} alt={project.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Work;
