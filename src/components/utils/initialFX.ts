import { SplitText } from "gsap/SplitText";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { smoother } from "../Navbar";

export function initialFX() {
  document.body.style.overflowY = "auto";
  if (smoother && typeof smoother.paused === "function") {
    smoother.paused(false);
  }
  const mainEl = document.getElementsByTagName("main")[0];
  if (mainEl) {
    mainEl.classList.add("main-active");
  }
  gsap.to("body", {
    backgroundColor: "#0b080c",
    duration: 0.5,
    delay: 1,
  });

  const introText = new SplitText(
    [".landing-intro h2", ".landing-intro h1"],
    {
      type: "chars,lines",
      linesClass: "split-line",
    }
  );
  gsap.fromTo(
    introText.chars,
    { opacity: 0, y: 80, filter: "blur(5px)" },
    {
      opacity: 1,
      duration: 1.2,
      filter: "blur(0px)",
      ease: "power3.inOut",
      y: 0,
      stagger: 0.025,
      delay: 0.3,
    }
  );

  const TextProps = { type: "chars,lines", linesClass: "split-h2" };

  const landingTextLine1_A = new SplitText(".landing-h2-1", TextProps);
  const landingTextLine1_B = new SplitText(".landing-h2-2", TextProps);
  const landingTextLine2_A = new SplitText(".landing-h2-info", TextProps);
  const landingTextLine2_B = new SplitText(".landing-h2-info-1", TextProps);

  gsap.fromTo(
    [landingTextLine1_A.chars, landingTextLine2_A.chars],
    { opacity: 0, y: 80, filter: "blur(5px)" },
    {
      opacity: 1,
      duration: 1.2,
      filter: "blur(0px)",
      ease: "power3.inOut",
      y: 0,
      stagger: 0.025,
      delay: 0.3,
    }
  );

  gsap.fromTo(
    [".header", ".icons-section", ".nav-fade"],
    { opacity: 0 },
    {
      opacity: 1,
      duration: 1.2,
      ease: "power1.inOut",
      delay: 0.1,
    }
  );

  LoopText(landingTextLine1_A, landingTextLine1_B);
  LoopText(landingTextLine2_A, landingTextLine2_B);

  // Refresh ScrollTrigger so all initial positions and smoother layout match
  ScrollTrigger.refresh();
}

function LoopText(Text1: SplitText, Text2: SplitText) {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
  const delay = 3.5;
  const delay2 = delay * 2 + 1;

  tl.fromTo(
    Text2.chars,
    { opacity: 0, y: 80 },
    {
      opacity: 1,
      duration: 1.2,
      ease: "power3.inOut",
      y: 0,
      stagger: 0.08,
      delay: delay,
    },
    0
  )
    .fromTo(
      Text1.chars,
      { y: 80 },
      {
        duration: 1.2,
        ease: "power3.inOut",
        y: 0,
        stagger: 0.08,
        delay: delay2,
      },
      1
    )
    .fromTo(
      Text1.chars,
      { y: 0 },
      {
        y: -80,
        duration: 1.2,
        ease: "power3.inOut",
        stagger: 0.08,
        delay: delay,
      },
      0
    )
    .to(
      Text2.chars,
      {
        y: -80,
        duration: 1.2,
        ease: "power3.inOut",
        stagger: 0.08,
        delay: delay2,
      },
      1
    );
}

