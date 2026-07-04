const popupButton = document.getElementById("popup-button");
const popupContainer = document.getElementById("popup-container");
const popupContent = document.getElementById("popup-content");
const loginButtonPop = document.getElementById("login-button");
const loginForm = document.getElementById("login-form-pop");
const registerButtonPop = document.getElementById("register-button");
const registerForm = document.getElementById("registration-form");

//popup chat
if (popupButton && popupContent && popupContainer) {
    popupButton.addEventListener("click", () => {
        if (popupContent.style.display === "flex") { //closed
            popupContent.style.display = "none";
            popupContainer.style.display = "none";
            popupButton.style.position = "fixed"; //popup button
            popupButton.style.bottom = "10px";
            popupButton.textContent = "Chat"; //changes text from close to chat
        } else {
            popupContent.style.display = "flex";
            popupContainer.style.display = "flex";
            popupButton.textContent = "Close";//changes text from chat to close
            popupButton.style.bottom = "72%";
            scrollToBottom();
        }
    });
}

//popup login
if (loginButtonPop && loginForm && registerForm) {
    loginButtonPop.addEventListener("click", () => {
        if (loginForm.classList.contains("show")) { //closed
            loginForm.classList.remove("show");
            setTimeout(() => { //allows the scale transition to finish before hiding the form
                loginForm.style.display = "none";
            }, 500);
        } else {
            loginForm.style.display = "block";
            registerForm.style.display = "none";
            setTimeout(() => {
                loginForm.classList.add("show");
            }, 0);
        }
    });
}

//popup register
if (registerButtonPop && registerForm && loginForm) {
    registerButtonPop.addEventListener("click", () => {
        if (registerForm.classList.contains("show")) {
            registerForm.classList.remove("show");
            setTimeout(() => {
                registerForm.style.display = "none";
            }, 500);
        } else {
            loginForm.style.display = "none";
            registerForm.style.display = "block";
            setTimeout(() => {
                registerForm.classList.add("show");
            }, 0);
        }
    });
}

function scrollToBottom() {
    chatsView.scrollTop = chatsView.scrollHeight; //scrolls to the bottom of the chat when called
}
