document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector("nav");
    const pulseTargets = Array.from(document.querySelectorAll(".wrapper, .wrapperleft, .wrappersmall"));

    if (!nav || pulseTargets.length === 0) {
        return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetState = new WeakMap();
    let lastScrollY = window.scrollY;
    let framePending = false;
    let navTimer = null;
    let pulseOverlay = document.querySelector(".nav-pulse-overlay");

    if (!pulseOverlay) {
        pulseOverlay = document.createElement("div");
        pulseOverlay.className = "nav-pulse-overlay";
        pulseOverlay.innerHTML = '<span class="nav-pulse-run left"></span><span class="nav-pulse-run right"></span><span class="nav-pulse-wave left"></span><span class="nav-pulse-wave right"></span><span class="nav-pulse-meet"></span>';
        document.body.appendChild(pulseOverlay);
    }

    if (!pulseOverlay.querySelector(".nav-pulse-run.left")) {
        pulseOverlay.insertAdjacentHTML("afterbegin", '<span class="nav-pulse-run left"></span>');
    }
    if (!pulseOverlay.querySelector(".nav-pulse-run.right")) {
        pulseOverlay.insertAdjacentHTML("afterbegin", '<span class="nav-pulse-run right"></span>');
    }
    if (!pulseOverlay.querySelector(".nav-pulse-wave.left")) {
        pulseOverlay.insertAdjacentHTML("beforeend", '<span class="nav-pulse-wave left"></span>');
    }
    if (!pulseOverlay.querySelector(".nav-pulse-wave.right")) {
        pulseOverlay.insertAdjacentHTML("beforeend", '<span class="nav-pulse-wave right"></span>');
    }
    if (!pulseOverlay.querySelector(".nav-pulse-meet")) {
        pulseOverlay.insertAdjacentHTML("beforeend", '<span class="nav-pulse-meet"></span>');
    }

    const activeWrapperTimers = new WeakMap();

    const pulseDuration = reducedMotion ? 180 : 900;
    const triggerBand = 12;
    const rearmBand = 120;

    pulseTargets.forEach((target) => {
        targetState.set(target, {
            lastTop: target.getBoundingClientRect().top,
            armed: true,
        });
    });

    function triggerNavPulse(leftX, rightX, wrapperElement) {
        if (navTimer) {
            clearTimeout(navTimer);
        }

        const navWidth = nav.getBoundingClientRect().width;
        const clampedLeft = Math.max(0, Math.min(navWidth, leftX));
        const clampedRight = Math.max(0, Math.min(navWidth, rightX));

        pulseOverlay.style.setProperty("--left-span", `${clampedLeft}px`);
        pulseOverlay.style.setProperty("--left-x", `${clampedLeft}px`);
        pulseOverlay.style.setProperty("--right-x", `${clampedRight}px`);
        pulseOverlay.style.setProperty("--right-span", `${Math.max(0, navWidth - clampedRight)}px`);

        if (wrapperElement) {
            const wrapperTimer = activeWrapperTimers.get(wrapperElement);
            if (wrapperTimer) {
                clearTimeout(wrapperTimer);
            }

            wrapperElement.classList.remove("border-pulse-hit");
            void wrapperElement.offsetWidth;
            wrapperElement.classList.add("border-pulse-hit");

            const wrapperTimeoutId = window.setTimeout(() => {
                wrapperElement.classList.remove("border-pulse-hit");
            }, pulseDuration);

            activeWrapperTimers.set(wrapperElement, wrapperTimeoutId);
        }

        nav.classList.remove("border-pulse-active");
        void nav.offsetWidth;
        nav.classList.add("border-pulse-active");

        pulseOverlay.classList.remove("active");
        void pulseOverlay.offsetWidth;
        pulseOverlay.classList.add("active");

        window.dispatchEvent(new CustomEvent('border-pulse-trigger', {
            detail: { left: leftX, right: rightX, target: wrapperElement }
        }));

        navTimer = window.setTimeout(() => {
            nav.classList.remove("border-pulse-active");
            pulseOverlay.classList.remove("active");
        }, pulseDuration);
    }

    function evaluatePulses() {
        framePending = false;

        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;
        lastScrollY = currentScrollY;

        const navBottom = nav.getBoundingClientRect().bottom;

        pulseTargets.forEach((target) => {
            const state = targetState.get(target);
            const rect = target.getBoundingClientRect();
            const crossedHeaderLine = state.lastTop > navBottom + triggerBand && rect.top <= navBottom + triggerBand;
            const farBelowHeader = rect.top > navBottom + rearmBand;

            if (scrollingDown && state.armed && crossedHeaderLine) {
                state.armed = false;
                triggerNavPulse(rect.left, rect.right, target);
            } else if (farBelowHeader) {
                state.armed = true;
            }

            state.lastTop = rect.top;
        });
    }

    function requestPulseCheck() {
        if (framePending) {
            return;
        }

        framePending = true;
        window.requestAnimationFrame(evaluatePulses);
    }

    window.addEventListener("scroll", requestPulseCheck, { passive: true });
    window.addEventListener("resize", requestPulseCheck);
    requestPulseCheck();
});